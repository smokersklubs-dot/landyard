<?php
/**
 * Liaison WooCommerce du configurateur Lanyard.
 *
 * 1. Chaque demande de devis crée une commande WooCommerce au statut « Devis demandé »
 *    (client, ligne « Lanyard personnalisé », configuration, fichiers). L'équipe saisit le prix,
 *    passe la commande « En attente de paiement » et envoie au client le lien de paiement WooCommerce.
 * 2. Panier direct : quand la grille de prix est saisie (Devis Event → Prix), le configurateur
 *    peut ajouter le lanyard au panier de sklubs.fr. Le prix est toujours recalculé ici, côté serveur.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sklubs_Event_Woo {

	const STATUS      = 'wc-sk-quote';
	const PRODUCT_OPT = 'sklubs_event_product_id';
	const PRICING_OPT = 'sklubs_event_pricing';
	const CART_TTL    = 7200;

	/** Grille vide : aucun prix n'est inventé. Même structure que products/lanyard/product.json (pricing). */
	const PRICING_TEMPLATE = '{
  "currency": "EUR",
  "moq": null,
  "basePriceByModel": { "classic": null, "sublimation": null, "woven": null, "tubular": null, "rpet": null, "phone": null, "wrist": null },
  "baseLengthByModel": { "classic": 900, "sublimation": 900, "woven": 900, "tubular": 900, "rpet": 900, "phone": 1200, "wrist": 300 },
  "widthSurcharge": { "8": null, "10": null, "12": null, "15": null, "20": null, "25": null },
  "lengthSurchargePer100mm": null,
  "materialSurcharge": { "polyester": null, "satin": null, "rpet": null, "woven": null, "bamboo": null, "tubular": null },
  "methodSurcharge": { "screen": null, "sublimation": null, "woven": null },
  "backPrintSurcharge": null,
  "breakawaySurcharge": { "none": 0, "safety": null },
  "buckleSurcharge": { "none": 0, "detachable": null },
  "attachmentSurcharge": { "snaphook": null, "swivel": null, "plasticclip": null, "keyring": null, "double": null, "phone": null, "none": 0 },
  "holderSurcharge": { "none": 0, "pvcsoft": null, "pvcrigid": null, "leather": null },
  "passPrintSurcharge": null,
  "setupFee": { "screen": null, "sublimation": null, "woven": null },
  "quantityDiscounts": null
}';

	public static function active() {
		return class_exists( 'WooCommerce' ) && function_exists( 'wc_create_order' );
	}

	public static function init() {
		add_action( 'before_woocommerce_init', function () {
			if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
				\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', SKLUBS_EQ_FILE, true );
			}
		} );
		add_action( 'init', array( __CLASS__, 'register_status' ) );
		add_filter( 'wc_order_statuses', array( __CLASS__, 'order_statuses' ) );
		add_filter( 'woocommerce_valid_order_statuses_for_payment', array( __CLASS__, 'payable' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
		add_action( 'template_redirect', array( __CLASS__, 'claim_cart' ) );
		add_action( 'woocommerce_before_calculate_totals', array( __CLASS__, 'cart_prices' ), 20 );
		add_filter( 'woocommerce_get_item_data', array( __CLASS__, 'cart_item_data' ), 10, 2 );
		add_action( 'woocommerce_checkout_create_order_line_item', array( __CLASS__, 'order_line_item' ), 10, 4 );
		add_filter( 'woocommerce_cart_item_quantity', array( __CLASS__, 'lock_quantity' ), 10, 3 );
		add_filter( 'woocommerce_add_cart_item_data', array( __CLASS__, 'unique_item' ), 10, 3 );
		add_action( 'woocommerce_after_order_itemmeta', array( __CLASS__, 'admin_item_files' ), 10, 2 );
	}

	/* ------------------------------------------------------------------ statut « Devis demandé » */

	public static function register_status() {
		register_post_status(
			self::STATUS,
			array(
				'label'                     => 'Devis demandé',
				'public'                    => false,
				'exclude_from_search'       => false,
				'show_in_admin_all_list'    => true,
				'show_in_admin_status_list' => true,
				/* translators: %s: nombre de commandes */
				'label_count'               => _n_noop( 'Devis demandé <span class="count">(%s)</span>', 'Devis demandés <span class="count">(%s)</span>' ),
			)
		);
	}

	public static function order_statuses( $statuses ) {
		$out = array();
		foreach ( $statuses as $k => $v ) {
			$out[ $k ] = $v;
			if ( 'wc-pending' === $k ) {
				$out[ self::STATUS ] = 'Devis demandé';
			}
		}
		if ( ! isset( $out[ self::STATUS ] ) ) {
			$out[ self::STATUS ] = 'Devis demandé';
		}
		return $out;
	}

	public static function payable( $statuses ) {
		$statuses[] = 'sk-quote';
		return $statuses;
	}

	/** Produit technique (masqué du catalogue) qui porte les lignes « Lanyard personnalisé ». */
	public static function product_id() {
		$id = (int) get_option( self::PRODUCT_OPT );
		if ( $id && 'product' === get_post_type( $id ) && 'trash' !== get_post_status( $id ) ) {
			return $id;
		}
		$p = new WC_Product_Simple();
		$p->set_name( 'Lanyard personnalisé (configurateur 3D)' );
		$p->set_status( 'publish' );
		$p->set_catalog_visibility( 'hidden' );
		$p->set_regular_price( '0' );
		$p->set_sold_individually( true );
		$p->set_tax_status( 'taxable' );
		$p->set_short_description( 'Lanyard configuré sur landyard.sklubs.fr. Le prix et les options sont fixés par le configurateur.' );
		$id = $p->save();
		update_option( self::PRODUCT_OPT, $id );
		return $id;
	}

	/* ------------------------------------------------------------------ 1. devis → commande */

	/** Appelé par le plugin principal après l'enregistrement d'une demande. */
	public static function order_from_quote( $post_id, $ref, $contact, $summary, $config, $files ) {
		if ( ! self::active() ) {
			return 0;
		}
		try {
			$order = wc_create_order( array( 'status' => 'sk-quote', 'created_via' => 'sklubs-configurator' ) );
			$parts = preg_split( '/\s+/', trim( $contact['name'] ), 2 );
			$order->set_billing_first_name( $parts[0] );
			$order->set_billing_last_name( isset( $parts[1] ) ? $parts[1] : '' );
			$order->set_billing_email( $contact['email'] );
			$order->set_billing_phone( $contact['phone'] );
			$order->set_billing_company( $contact['company'] );
			$user = get_user_by( 'email', $contact['email'] );
			if ( $user ) {
				$order->set_customer_id( $user->ID );
			}
			$product = wc_get_product( self::product_id() );
			$item_id = $order->add_product( $product, max( 1, (int) $contact['quantity'] ), array( 'subtotal' => 0, 'total' => 0 ) );
			$item    = $order->get_item( $item_id );
			self::describe_item( $item, $ref, $summary, $config );
			if ( $item ) {
				$item->add_meta_data( '_sk_quote_post', (int) $post_id, true );
				$item->save();
			}
			$order->update_meta_data( '_sk_ref', $ref );
			$order->update_meta_data( '_sk_quote_post', $post_id );
			if ( $contact['event_date'] ) {
				$order->update_meta_data( '_sk_event_date', $contact['event_date'] );
			}
			if ( $contact['message'] ) {
				$order->set_customer_note( $contact['message'] );
			}
			$order->calculate_totals( false );
			$order->add_order_note(
				"Demande de devis {$ref} reçue du configurateur Lanyard.\n" .
				'Fichiers (BAT, logo, aperçu) : ' . admin_url( 'post.php?post=' . $post_id . '&action=edit' ) . "\n" .
				"Pour envoyer le devis : saisir le prix de la ligne, recalculer, passer la commande « En attente de paiement », puis « Envoyer la facture au client » (lien de paiement)."
			);
			$order->save();
			update_post_meta( $post_id, '_sk_order', $order->get_id() );
			return $order->get_id();
		} catch ( Exception $e ) {
			update_post_meta( $post_id, '_sk_order_error', $e->getMessage() );
			return 0;
		}
	}

	/** Ligne de commande lisible : une méta par ligne du récapitulatif. */
	private static function describe_item( $item, $ref, $summary, $config ) {
		if ( ! $item ) {
			return;
		}
		$item->add_meta_data( 'Référence', $ref, true );
		foreach ( preg_split( '/\r?\n/', (string) $summary ) as $line ) {
			$pos = strpos( $line, ' : ' );
			if ( false === $pos ) {
				continue;
			}
			$k = trim( substr( $line, 0, $pos ) );
			if ( '' === $k || 'Quantité' === $k ) {
				continue;
			}
			$item->add_meta_data( $k, trim( substr( $line, $pos + 3 ) ), true );
		}
		$item->add_meta_data( '_sk_config', wp_json_encode( $config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ), true );
	}

	/* ------------------------------------------------------------------ 2. grille de prix + panier */

	public static function pricing() {
		$raw = get_option( self::PRICING_OPT, '' );
		$p   = json_decode( $raw ? $raw : self::PRICING_TEMPLATE, true );
		return is_array( $p ) ? $p : json_decode( self::PRICING_TEMPLATE, true );
	}

	public static function routes() {
		register_rest_route(
			'sklubs/v1',
			'/pricing',
			array(
				'methods'             => 'GET',
				'callback'            => function () {
					$p = self::pricing();
					return array( 'woocommerce' => self::active(), 'cart' => self::active(), 'pricing' => $p );
				},
				'permission_callback' => '__return_true',
			)
		);
		register_rest_route(
			'sklubs/v1',
			'/cart',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'prepare_cart' ),
				'permission_callback' => '__return_true',
			)
		);
	}

	private static function defined_number( $v ) {
		return null !== $v && '' !== $v && 'TO_DEFINE' !== $v && is_numeric( $v );
	}

	/**
	 * Portage PHP de computePrice() (js/pricing.js). Renvoie [prix unitaire HT, manques].
	 * $c : TYPE, WIDTH_MM, LENGTH_MM, MATERIAL, PRINT_METHOD, BACK, BREAKAWAY, BUCKLE, ATTACHMENT, KIT, HOLDER.
	 */
	public static function compute( $c, $qty ) {
		$p       = self::pricing();
		$missing = array();
		$need    = function ( $label, $v ) use ( &$missing ) {
			if ( ! self::defined_number( $v ) ) {
				$missing[] = $label;
				return 0.0;
			}
			return (float) $v;
		};
		$get     = function ( $map, $key ) use ( $p ) {
			return isset( $p[ $map ] ) && is_array( $p[ $map ] ) && array_key_exists( (string) $key, $p[ $map ] ) ? $p[ $map ][ (string) $key ] : null;
		};
		$unit  = $need( 'prix de base', $get( 'basePriceByModel', $c['TYPE'] ) );
		$unit += $need( 'supplément largeur', $get( 'widthSurcharge', $c['WIDTH_MM'] ) );
		$base  = $get( 'baseLengthByModel', $c['TYPE'] );
		if ( self::defined_number( $base ) && (int) $c['LENGTH_MM'] !== (int) $base ) {
			$unit += $need( 'supplément longueur', isset( $p['lengthSurchargePer100mm'] ) ? $p['lengthSurchargePer100mm'] : null ) * ( ( (int) $c['LENGTH_MM'] - (int) $base ) / 100 );
		}
		$unit += $need( 'supplément matière', $get( 'materialSurcharge', $c['MATERIAL'] ) );
		$unit += $need( 'supplément impression', $get( 'methodSurcharge', $c['PRINT_METHOD'] ) );
		if ( 'none' !== $c['BACK'] ) {
			$unit += $need( 'impression verso', isset( $p['backPrintSurcharge'] ) ? $p['backPrintSurcharge'] : null );
		}
		$unit += $need( 'breakaway', $get( 'breakawaySurcharge', $c['BREAKAWAY'] ) );
		$unit += $need( 'boucle', $get( 'buckleSurcharge', $c['BUCKLE'] ) );
		$unit += $need( 'attache', $get( 'attachmentSurcharge', $c['ATTACHMENT'] ) );
		if ( 'lanyard' !== $c['KIT'] ) {
			$unit += $need( 'porte-badge', $get( 'holderSurcharge', $c['HOLDER'] ) );
		}
		if ( 'pass' === $c['KIT'] ) {
			$unit += $need( 'pass imprimé', isset( $p['passPrintSurcharge'] ) ? $p['passPrintSurcharge'] : null );
		}
		$setup = $need( 'frais de calage', $get( 'setupFee', $c['PRINT_METHOD'] ) );
		$moq   = isset( $p['moq'] ) ? $p['moq'] : null;
		if ( ! self::defined_number( $moq ) ) {
			$missing[] = 'MOQ';
		} elseif ( $qty < (int) $moq ) {
			$missing[] = 'quantité minimale ' . (int) $moq;
		}
		$discount = 0.0;
		if ( ! empty( $p['quantityDiscounts'] ) && is_array( $p['quantityDiscounts'] ) ) {
			foreach ( $p['quantityDiscounts'] as $t ) {
				if ( isset( $t['min'], $t['discount'] ) && $qty >= (int) $t['min'] ) {
					$discount = (float) $t['discount'];
				}
			}
		}
		$u = $unit * ( 1 - $discount ) + $setup / max( 1, $qty );
		return array( round( $u, 4 ), array_values( array_unique( $missing ) ) );
	}

	/** Lit la configuration envoyée (structure LANYARD de l'export projet) en valeurs sûres. */
	private static function read_config( $config ) {
		$l   = isset( $config['LANYARD'] ) && is_array( $config['LANYARD'] ) ? $config['LANYARD'] : array();
		$key = function ( $k, $def = '' ) use ( $l ) {
			return isset( $l[ $k ] ) && is_scalar( $l[ $k ] ) ? sanitize_key( (string) $l[ $k ] ) : $def;
		};
		$art = isset( $l['ARTWORK'] ) && is_array( $l['ARTWORK'] ) ? $l['ARTWORK'] : array();
		$hol = isset( $l['HOLDER'] ) && is_array( $l['HOLDER'] ) ? $l['HOLDER'] : array();
		return array(
			'TYPE'         => $key( 'TYPE' ),
			'WIDTH_MM'     => isset( $l['WIDTH_MM'] ) ? (int) $l['WIDTH_MM'] : 0,
			'LENGTH_MM'    => isset( $l['LENGTH_MM'] ) ? (int) $l['LENGTH_MM'] : 0,
			'MATERIAL'     => $key( 'MATERIAL' ),
			'PRINT_METHOD' => $key( 'PRINT_METHOD' ),
			'BACK'         => empty( $art['BACK'] ) ? 'none' : 'back',
			'BREAKAWAY'    => $key( 'BREAKAWAY', 'none' ),
			'BUCKLE'       => $key( 'BUCKLE', 'none' ),
			'ATTACHMENT'   => $key( 'ATTACHMENT', 'none' ),
			'KIT'          => $key( 'KIT', 'lanyard' ),
			'HOLDER'       => isset( $hol['type'] ) ? sanitize_key( (string) $hol['type'] ) : 'none',
		);
	}

	/** Étape 1 (depuis landyard.sklubs.fr) : valide, chiffre, garde la ligne en attente, renvoie l'URL d'ajout. */
	public static function prepare_cart( WP_REST_Request $req ) {
		if ( ! self::active() ) {
			return new WP_Error( 'sklubs_woo', 'WooCommerce indisponible.', array( 'status' => 503 ) );
		}
		$guard = Sklubs_Event_Quotes::guard( $req );
		if ( is_wp_error( $guard ) ) {
			return $guard;
		}
		$raw = (string) $req->get_param( 'configuration' );
		if ( strlen( $raw ) > Sklubs_Event_Quotes::MAX_JSON ) {
			return new WP_Error( 'sklubs_config', 'Configuration trop volumineuse.', array( 'status' => 400 ) );
		}
		$config = json_decode( $raw, true );
		if ( ! is_array( $config ) ) {
			return new WP_Error( 'sklubs_config', 'Configuration manquante ou illisible.', array( 'status' => 400 ) );
		}
		$qty               = max( 1, absint( isset( $config['LANYARD']['QUANTITY'] ) ? $config['LANYARD']['QUANTITY'] : 0 ) );
		$c                 = self::read_config( $config );
		list( $unit, $miss ) = self::compute( $c, $qty );
		if ( $miss || $unit <= 0 ) {
			return new WP_Error( 'sklubs_price', 'Prix non disponible pour cette configuration : demandez un devis.', array( 'status' => 409, 'missing' => $miss ) );
		}
		$ref = preg_replace( '/[^A-Z0-9-]/', '', strtoupper( (string) $req->get_param( 'reference' ) ) );
		$ref = $ref ? substr( $ref, 0, 24 ) : 'SK-' . strtoupper( base_convert( (string) time(), 10, 36 ) );

		// Fichiers (BAT, logo…) rangés comme pour un devis, liés à une fiche « Devis Event » de type panier.
		$post_id = wp_insert_post(
			array(
				'post_type'   => Sklubs_Event_Quotes::CPT,
				'post_status' => 'private',
				'post_title'  => sprintf( '%s — panier (%d pcs)', $ref, $qty ),
			)
		);
		$files = $post_id ? Sklubs_Event_Quotes::store_files( $req->get_file_params(), $post_id, $ref ) : array();
		if ( $post_id ) {
			update_post_meta( $post_id, '_sk_ref', $ref );
			update_post_meta( $post_id, '_sk_config', wp_slash( wp_json_encode( $config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) );
			update_post_meta( $post_id, '_sk_summary', sanitize_textarea_field( (string) $req->get_param( 'summary' ) ) );
			update_post_meta( $post_id, '_sk_status', 'progress' );
			update_post_meta( $post_id, '_sk_files', $files );
		}
		$token = wp_generate_password( 32, false );
		set_transient(
			'sk_cart_' . $token,
			array(
				'ref'     => $ref,
				'qty'     => $qty,
				'unit'    => $unit,
				'config'  => $c,
				'summary' => sanitize_textarea_field( (string) $req->get_param( 'summary' ) ),
				'post'    => $post_id,
			),
			self::CART_TTL
		);
		return array(
			'ok'       => true,
			'unit'     => $unit,
			'total'    => round( $unit * $qty, 2 ),
			'currency' => get_woocommerce_currency(),
			'url'      => add_query_arg( 'sk_cart', $token, wc_get_cart_url() ),
		);
	}

	/** Étape 2 (navigateur du client sur sklubs.fr) : ajoute la ligne au panier de sa session. */
	public static function claim_cart() {
		if ( empty( $_GET['sk_cart'] ) || ! self::active() || ! function_exists( 'WC' ) || ! WC()->cart ) {
			return;
		}
		// Visiteur non connecté : ouvrir sa session WooCommerce pour que le panier soit conservé.
		if ( WC()->session && ! WC()->session->has_session() ) {
			WC()->session->set_customer_session_cookie( true );
		}
		$token = preg_replace( '/[^A-Za-z0-9]/', '', (string) wp_unslash( $_GET['sk_cart'] ) );
		$data  = get_transient( 'sk_cart_' . $token );
		delete_transient( 'sk_cart_' . $token );
		if ( $data ) {
			// Revalidation au moment de l'ajout (la grille a pu changer).
			list( $unit, $miss ) = self::compute( $data['config'], (int) $data['qty'] );
			if ( ! $miss && $unit > 0 ) {
				$data['unit'] = $unit;
				WC()->cart->add_to_cart( self::product_id(), 1, 0, array(), array( 'sk_lanyard' => $data ) );
				wc_add_notice( 'Votre lanyard personnalisé a été ajouté au panier.', 'success' );
			} else {
				wc_add_notice( "Le prix de cette configuration n'est plus disponible : demandez un devis.", 'error' );
			}
		} else {
			wc_add_notice( 'Ce lien a expiré : ajoutez à nouveau votre lanyard depuis le configurateur.', 'error' );
		}
		wp_safe_redirect( remove_query_arg( 'sk_cart' ) );
		exit;
	}

	/** Chaque configuration est une ligne distincte. */
	public static function unique_item( $data, $product_id, $variation_id ) {
		if ( ! empty( $data['sk_lanyard'] ) ) {
			$data['sk_unique'] = md5( wp_json_encode( $data['sk_lanyard'] ) . microtime() );
		}
		return $data;
	}

	/** La ligne porte un lot entier : prix = prix unitaire × quantité commandée. */
	public static function cart_prices( $cart ) {
		foreach ( $cart->get_cart() as $item ) {
			if ( ! empty( $item['sk_lanyard'] ) ) {
				$d = $item['sk_lanyard'];
				$item['data']->set_price( round( (float) $d['unit'] * (int) $d['qty'], 2 ) );
				$item['data']->set_name( sprintf( 'Lanyard personnalisé × %s pcs', number_format_i18n( (int) $d['qty'] ) ) );
			}
		}
	}

	public static function lock_quantity( $html, $key, $item ) {
		return empty( $item['sk_lanyard'] ) ? $html : '1 lot';
	}

	private static function summary_rows( $summary ) {
		$rows = array();
		foreach ( preg_split( '/\r?\n/', (string) $summary ) as $line ) {
			$pos = strpos( $line, ' : ' );
			if ( false !== $pos ) {
				$rows[ trim( substr( $line, 0, $pos ) ) ] = trim( substr( $line, $pos + 3 ) );
			}
		}
		return $rows;
	}

	public static function cart_item_data( $data, $item ) {
		if ( empty( $item['sk_lanyard'] ) ) {
			return $data;
		}
		$d      = $item['sk_lanyard'];
		$data[] = array( 'key' => 'Référence', 'value' => esc_html( $d['ref'] ) );
		$data[] = array( 'key' => 'Prix unitaire HT', 'value' => html_entity_decode( wp_strip_all_tags( wc_price( $d['unit'] ) ) ) );
		foreach ( self::summary_rows( $d['summary'] ) as $k => $v ) {
			if ( in_array( $k, array( 'Modèle', 'Largeur', 'Longueur', 'Matière', 'Couleur', 'Impression', 'Attache', 'Porte-badge', 'Quantité' ), true ) ) {
				$data[] = array( 'key' => esc_html( $k ), 'value' => esc_html( $v ) );
			}
		}
		return $data;
	}

	public static function order_line_item( $line, $cart_key, $values, $order ) {
		if ( empty( $values['sk_lanyard'] ) ) {
			return;
		}
		$d = $values['sk_lanyard'];
		$line->add_meta_data( 'Référence', $d['ref'], true );
		$line->add_meta_data( 'Quantité (pièces)', (int) $d['qty'], true );
		$line->add_meta_data( 'Prix unitaire HT', $d['unit'], true );
		foreach ( self::summary_rows( $d['summary'] ) as $k => $v ) {
			if ( 'Quantité' !== $k ) {
				$line->add_meta_data( $k, $v, true );
			}
		}
		if ( ! empty( $d['post'] ) ) {
			$line->add_meta_data( '_sk_quote_post', (int) $d['post'], true );
		}
	}

	/** Admin de la commande : lien vers les fichiers (BAT, logo, aperçu) sous la ligne du lanyard. */
	public static function admin_item_files( $item_id, $item ) {
		$post = (int) $item->get_meta( '_sk_quote_post' );
		if ( $post ) {
			echo '<p><a href="' . esc_url( admin_url( 'post.php?post=' . $post . '&action=edit' ) ) . '">Voir le BAT, le logo et l\'aperçu 3D →</a></p>';
		}
	}
}
