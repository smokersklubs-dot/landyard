<?php
/**
 * Plugin Name:       SKLUBS Event Quotes
 * Description:       Reçoit les demandes de devis du configurateur Lanyard (landyard.sklubs.fr) : enregistrement dans l'admin, fichiers (BAT, logo, aperçu), e-mail à l'équipe et accusé de réception au client.
 * Version:           1.1.0
 * WC requires at least: 7.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            SKLUBS
 * Text Domain:       sklubs-event-quotes
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SKLUBS_EQ_FILE', __FILE__ );
require_once __DIR__ . '/includes/class-woo.php';

final class Sklubs_Event_Quotes {

	const CPT       = 'sklubs_quote';
	const OPTION    = 'sklubs_event_quotes';
	const DIR       = 'sklubs-quotes';
	const MAX_FILE  = 10485760; // 10 Mo par fichier
	const MAX_JSON  = 300000;   // 300 Ko de configuration
	const RATE      = 5;        // demandes par IP ...
	const RATE_WIN  = 600;      // ... toutes les 10 minutes

	/** Fichiers acceptés : champ => types MIME autorisés. */
	const FILES = array(
		'bat'       => array( 'application/pdf' ),
		'bat_svg'   => array( 'image/svg+xml', 'text/xml', 'application/xml', 'text/plain' ),
		'preview'   => array( 'image/png', 'image/jpeg' ),
		'logo'      => array( 'image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf', 'text/xml', 'text/plain' ),
		'logo_back' => array( 'image/png', 'image/jpeg', 'image/svg+xml', 'application/pdf', 'text/xml', 'text/plain' ),
		'pass_art'  => array( 'image/png', 'image/jpeg', 'image/svg+xml', 'text/xml', 'text/plain' ),
	);

	const STATUSES = array(
		'new'      => 'Nouveau',
		'progress' => 'En cours',
		'sent'     => 'Devis envoyé',
		'won'      => 'Gagné',
		'lost'     => 'Perdu',
	);

	public static function init() {
		add_action( 'init', array( __CLASS__, 'register_cpt' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_route' ) );
		add_filter( 'rest_pre_serve_request', array( __CLASS__, 'cors' ), 20, 4 );
		add_action( 'admin_menu', array( __CLASS__, 'admin_menu' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
		add_action( 'add_meta_boxes', array( __CLASS__, 'meta_boxes' ) );
		add_action( 'save_post_' . self::CPT, array( __CLASS__, 'save_status' ), 10, 2 );
		add_filter( 'manage_' . self::CPT . '_posts_columns', array( __CLASS__, 'columns' ) );
		add_action( 'manage_' . self::CPT . '_posts_custom_column', array( __CLASS__, 'column' ), 10, 2 );
		add_action( 'admin_post_sklubs_quote_file', array( __CLASS__, 'download' ) );
		add_shortcode( 'sklubs_lanyard_button', array( __CLASS__, 'shortcode' ) );
		register_activation_hook( __FILE__, array( __CLASS__, 'activate' ) );
	}

	/* ------------------------------------------------------------------ réglages */

	public static function settings() {
		return wp_parse_args(
			get_option( self::OPTION, array() ),
			array(
				'recipients'     => get_option( 'admin_email' ),
				'origins'        => "https://landyard.sklubs.fr\nhttps://sklubs.fr",
				'confirm_client' => 1,
				'configurator'   => 'https://landyard.sklubs.fr',
			)
		);
	}

	public static function activate() {
		self::register_cpt();
		self::storage_dir();
		flush_rewrite_rules();
	}

	/** Dossier privé des fichiers : uploads/sklubs-quotes (accès direct refusé). */
	private static function storage_dir() {
		$up  = wp_upload_dir();
		$dir = trailingslashit( $up['basedir'] ) . self::DIR;
		if ( ! is_dir( $dir ) ) {
			wp_mkdir_p( $dir );
		}
		if ( ! file_exists( $dir . '/.htaccess' ) ) {
			file_put_contents( $dir . '/.htaccess', "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n" );
		}
		if ( ! file_exists( $dir . '/index.php' ) ) {
			file_put_contents( $dir . '/index.php', "<?php // Silence.\n" );
		}
		return $dir;
	}

	/* ------------------------------------------------------------------ type de contenu */

	public static function register_cpt() {
		register_post_type(
			self::CPT,
			array(
				'labels'          => array(
					'name'          => 'Devis Lanyard',
					'singular_name' => 'Devis Lanyard',
					'menu_name'     => 'Devis Event',
					'all_items'     => 'Toutes les demandes',
					'edit_item'     => 'Demande de devis',
					'search_items'  => 'Rechercher une demande',
					'not_found'     => 'Aucune demande pour le moment.',
				),
				'public'          => false,
				'show_ui'         => true,
				'show_in_menu'    => true,
				'menu_icon'       => 'dashicons-id-alt',
				'menu_position'   => 56,
				'supports'        => array( 'title' ),
				'capability_type' => 'post',
				'capabilities'    => array( 'create_posts' => 'do_not_allow' ),
				'map_meta_cap'    => true,
			)
		);
	}

	/* ------------------------------------------------------------------ API */

	public static function register_route() {
		register_rest_route(
			'sklubs/v1',
			'/quote',
			array(
				'methods'             => 'POST',
				'callback'            => array( __CLASS__, 'handle' ),
				'permission_callback' => '__return_true', // public : contrôles d'origine, anti-spam et limite de débit dans handle()
			)
		);
		register_rest_route(
			'sklubs/v1',
			'/ping',
			array(
				'methods'             => 'GET',
				'callback'            => function () {
					return array( 'ok' => true, 'version' => '1.1.0', 'woocommerce' => Sklubs_Event_Woo::active() );
				},
				'permission_callback' => '__return_true',
			)
		);
	}

	private static function allowed_origins() {
		$list = preg_split( '/[\s,]+/', (string) self::settings()['origins'] );
		return array_values( array_filter( array_map( 'untrailingslashit', array_map( 'trim', $list ) ) ) );
	}

	/** En-têtes CORS limités aux origines autorisées, pour nos routes uniquement. */
	public static function cors( $served, $result, $request, $server ) {
		if ( 0 !== strpos( $request->get_route(), '/sklubs/v1/' ) ) {
			return $served;
		}
		$origin = get_http_origin();
		if ( $origin && in_array( untrailingslashit( $origin ), self::allowed_origins(), true ) ) {
			header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $origin ) );
			header( 'Access-Control-Allow-Methods: POST, GET, OPTIONS' );
			header( 'Access-Control-Allow-Headers: Accept, Content-Type' );
			header( 'Vary: Origin', false );
		} else {
			header_remove( 'Access-Control-Allow-Origin' );
			header_remove( 'Access-Control-Allow-Credentials' );
		}
		return $served;
	}

	private static function error( $code, $message, $status = 400 ) {
		return new WP_Error( $code, $message, array( 'status' => $status ) );
	}

	private static function client_ip() {
		$ip = isset( $_SERVER['HTTP_CF_CONNECTING_IP'] ) ? $_SERVER['HTTP_CF_CONNECTING_IP'] : ( isset( $_SERVER['REMOTE_ADDR'] ) ? $_SERVER['REMOTE_ADDR'] : '' );
		return sanitize_text_field( wp_unslash( $ip ) );
	}

	/** Contrôles communs aux routes publiques : origine, champ piège, limite de débit. */
	public static function guard( WP_REST_Request $req ) {
		$origin = get_http_origin();
		if ( $origin && ! in_array( untrailingslashit( $origin ), self::allowed_origins(), true ) ) {
			return self::error( 'sklubs_origin', 'Origine non autorisée.', 403 );
		}
		if ( '' !== trim( (string) $req->get_param( 'website' ) ) ) {
			return self::error( 'sklubs_spam', 'Demande refusée.', 400 );
		}
		$key  = 'sklubs_q_' . md5( self::client_ip() );
		$hits = (int) get_transient( $key );
		if ( $hits >= self::RATE ) {
			return self::error( 'sklubs_rate', 'Trop de demandes. Réessayez dans quelques minutes.', 429 );
		}
		set_transient( $key, $hits + 1, self::RATE_WIN );
		return true;
	}

	public static function handle( WP_REST_Request $req ) {
		// Champ piège rempli : on répond « ok » sans rien enregistrer (le robot ne voit pas la différence).
		if ( '' !== trim( (string) $req->get_param( 'website' ) ) ) {
			return array( 'ok' => true, 'reference' => 'SK-0' );
		}
		$guard = self::guard( $req );
		if ( is_wp_error( $guard ) ) {
			return $guard;
		}

		$name  = sanitize_text_field( (string) $req->get_param( 'name' ) );
		$email = sanitize_email( (string) $req->get_param( 'email' ) );
		if ( '' === $name || ! is_email( $email ) ) {
			return self::error( 'sklubs_contact', 'Indiquez votre nom et une adresse e-mail valide.' );
		}
		$contact = array(
			'name'       => $name,
			'email'      => $email,
			'company'    => sanitize_text_field( (string) $req->get_param( 'company' ) ),
			'phone'      => sanitize_text_field( (string) $req->get_param( 'phone' ) ),
			'event_date' => sanitize_text_field( (string) $req->get_param( 'event_date' ) ),
			'quantity'   => max( 1, absint( $req->get_param( 'quantity' ) ) ),
			'message'    => sanitize_textarea_field( (string) $req->get_param( 'message' ) ),
		);
		$ref = preg_replace( '/[^A-Z0-9-]/', '', strtoupper( (string) $req->get_param( 'reference' ) ) );
		if ( '' === $ref ) {
			$ref = 'SK-' . strtoupper( base_convert( (string) time(), 10, 36 ) );
		}
		$ref = substr( $ref, 0, 24 );

		$raw = (string) $req->get_param( 'configuration' );
		if ( strlen( $raw ) > self::MAX_JSON ) {
			return self::error( 'sklubs_config', 'Configuration trop volumineuse.' );
		}
		$config = json_decode( $raw, true );
		if ( ! is_array( $config ) ) {
			return self::error( 'sklubs_config', 'Configuration manquante ou illisible.' );
		}
		$summary = sanitize_textarea_field( (string) $req->get_param( 'summary' ) );

		$post_id = wp_insert_post(
			array(
				'post_type'   => self::CPT,
				'post_status' => 'private',
				'post_title'  => sprintf( '%s — %s (%d pcs)', $ref, $contact['company'] ? $contact['company'] : $contact['name'], $contact['quantity'] ),
			),
			true
		);
		if ( is_wp_error( $post_id ) ) {
			return self::error( 'sklubs_save', "La demande n'a pas pu être enregistrée.", 500 );
		}
		update_post_meta( $post_id, '_sk_ref', $ref );
		update_post_meta( $post_id, '_sk_contact', $contact );
		update_post_meta( $post_id, '_sk_config', wp_slash( wp_json_encode( $config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) );
		update_post_meta( $post_id, '_sk_summary', $summary );
		update_post_meta( $post_id, '_sk_status', 'new' );
		update_post_meta( $post_id, '_sk_ip', self::client_ip() );

		$files = self::store_files( $req->get_file_params(), $post_id, $ref );
		update_post_meta( $post_id, '_sk_files', $files );

		$order_id = Sklubs_Event_Woo::order_from_quote( $post_id, $ref, $contact, $summary, $config, $files );
		self::notify( $post_id, $ref, $contact, $summary, $files, $order_id );
		return array( 'ok' => true, 'reference' => $ref );
	}

	/** Valide (taille, type réel) et range les fichiers dans un dossier privé propre à la demande. */
	public static function store_files( $uploaded, $post_id, $ref ) {
		$saved = array();
		if ( empty( $uploaded ) ) {
			return $saved;
		}
		$dir = self::storage_dir() . '/' . $post_id . '-' . wp_generate_password( 12, false );
		$finfo = function_exists( 'finfo_open' ) ? finfo_open( FILEINFO_MIME_TYPE ) : null;
		foreach ( self::FILES as $field => $mimes ) {
			if ( empty( $uploaded[ $field ] ) || UPLOAD_ERR_OK !== $uploaded[ $field ]['error'] ) {
				continue;
			}
			$f = $uploaded[ $field ];
			if ( $f['size'] <= 0 || $f['size'] > self::MAX_FILE || ! is_uploaded_file( $f['tmp_name'] ) ) {
				continue;
			}
			$mime = $finfo ? finfo_file( $finfo, $f['tmp_name'] ) : $f['type'];
			if ( ! in_array( $mime, $mimes, true ) ) {
				continue;
			}
			// Les fichiers texte ne sont acceptés que s'ils sont bien des SVG.
			if ( in_array( $mime, array( 'text/xml', 'application/xml', 'text/plain' ), true ) && false === stripos( (string) file_get_contents( $f['tmp_name'], false, null, 0, 4096 ), '<svg' ) ) {
				continue;
			}
			$ext  = strtolower( pathinfo( $f['name'], PATHINFO_EXTENSION ) );
			$ext  = in_array( $ext, array( 'pdf', 'png', 'jpg', 'jpeg', 'svg' ), true ) ? $ext : 'bin';
			$base = sanitize_file_name( $ref . '-' . $field . '.' . $ext );
			wp_mkdir_p( $dir );
			if ( move_uploaded_file( $f['tmp_name'], $dir . '/' . $base ) ) {
				$saved[ $field ] = array(
					'path' => $dir . '/' . $base,
					'name' => $base,
					'orig' => sanitize_file_name( $f['name'] ),
					'mime' => $mime,
					'size' => (int) $f['size'],
				);
			}
		}
		if ( $finfo ) {
			finfo_close( $finfo );
		}
		return $saved;
	}

	private static function notify( $post_id, $ref, $contact, $summary, $files, $order_id = 0 ) {
		$s          = self::settings();
		$recipients = array_filter( array_map( 'trim', preg_split( '/[\s,;]+/', (string) $s['recipients'] ) ), 'is_email' );
		$edit       = admin_url( 'post.php?post=' . $post_id . '&action=edit' );
		$lines      = array(
			'Nouvelle demande de devis — configurateur Lanyard',
			'',
			'Référence : ' . $ref,
			'Nom : ' . $contact['name'],
			'Société : ' . ( $contact['company'] ? $contact['company'] : '—' ),
			'E-mail : ' . $contact['email'],
			'Téléphone : ' . ( $contact['phone'] ? $contact['phone'] : '—' ),
			"Date de l'événement : " . ( $contact['event_date'] ? $contact['event_date'] : '—' ),
			'Quantité : ' . $contact['quantity'],
			'',
			$summary,
			'',
			'Message : ' . ( $contact['message'] ? $contact['message'] : '—' ),
			'',
			'Voir la demande : ' . $edit,
		);
		if ( $order_id ) {
			$order   = wc_get_order( $order_id );
			$lines[] = 'Commande WooCommerce « Devis demandé » n° ' . $order_id . ' : ' . ( $order ? $order->get_edit_order_url() : admin_url( 'post.php?post=' . $order_id . '&action=edit' ) );
			$lines[] = 'Pour chiffrer : saisir le prix, passer « En attente de paiement », puis « Envoyer la facture au client ».';
		}
		$attach = array();
		foreach ( array( 'bat', 'logo', 'logo_back', 'pass_art', 'preview' ) as $k ) {
			if ( ! empty( $files[ $k ] ) ) {
				$attach[] = $files[ $k ]['path'];
			}
		}
		$headers = array( 'Content-Type: text/plain; charset=UTF-8', 'Reply-To: ' . $contact['name'] . ' <' . $contact['email'] . '>' );
		if ( $recipients ) {
			wp_mail( $recipients, sprintf( '[Devis Lanyard] %s — %s', $ref, $contact['company'] ? $contact['company'] : $contact['name'] ), implode( "\n", $lines ), $headers, $attach );
		}
		if ( ! empty( $s['confirm_client'] ) ) {
			$body = implode(
				"\n",
				array(
					'Bonjour ' . $contact['name'] . ',',
					'',
					'Merci pour votre demande de devis SKLUBS (référence ' . $ref . ').',
					"Notre équipe vérifie votre configuration avec l'usine et revient vers vous rapidement avec un prix et un BAT validé.",
					'',
					$summary,
					'',
					"L'équipe SKLUBS",
					home_url( '/' ),
				)
			);
			wp_mail( $contact['email'], 'Votre demande de devis SKLUBS — ' . $ref, $body, array( 'Content-Type: text/plain; charset=UTF-8' ) );
		}
	}

	/* ------------------------------------------------------------------ admin */

	public static function columns( $cols ) {
		return array(
			'cb'        => $cols['cb'],
			'title'     => 'Demande',
			'sk_status' => 'Statut',
			'sk_email'  => 'E-mail',
			'sk_qty'    => 'Quantité',
			'sk_event'  => 'Événement',
			'date'      => 'Reçue le',
		);
	}

	public static function column( $col, $post_id ) {
		$c = (array) get_post_meta( $post_id, '_sk_contact', true );
		switch ( $col ) {
			case 'sk_status':
				$st = get_post_meta( $post_id, '_sk_status', true );
				echo esc_html( isset( self::STATUSES[ $st ] ) ? self::STATUSES[ $st ] : 'Nouveau' );
				break;
			case 'sk_email':
				echo isset( $c['email'] ) ? '<a href="mailto:' . esc_attr( $c['email'] ) . '">' . esc_html( $c['email'] ) . '</a>' : '';
				break;
			case 'sk_qty':
				echo isset( $c['quantity'] ) ? esc_html( number_format_i18n( $c['quantity'] ) ) : '';
				break;
			case 'sk_event':
				echo isset( $c['event_date'] ) ? esc_html( $c['event_date'] ) : '';
				break;
		}
	}

	public static function meta_boxes() {
		add_meta_box( 'sk_quote', 'Demande de devis', array( __CLASS__, 'box_quote' ), self::CPT, 'normal', 'high' );
		add_meta_box( 'sk_status', 'Suivi', array( __CLASS__, 'box_status' ), self::CPT, 'side', 'high' );
		add_meta_box( 'sk_files', 'Fichiers', array( __CLASS__, 'box_files' ), self::CPT, 'side' );
	}

	public static function box_quote( $post ) {
		$c   = (array) get_post_meta( $post->ID, '_sk_contact', true );
		$sum = (string) get_post_meta( $post->ID, '_sk_summary', true );
		$cfg = (string) get_post_meta( $post->ID, '_sk_config', true );
		echo '<table class="widefat striped" style="margin-bottom:12px"><tbody>';
		$rows = array(
			'Référence' => get_post_meta( $post->ID, '_sk_ref', true ),
			'Nom'       => isset( $c['name'] ) ? $c['name'] : '',
			'Société'   => isset( $c['company'] ) ? $c['company'] : '',
			'E-mail'    => isset( $c['email'] ) ? $c['email'] : '',
			'Téléphone' => isset( $c['phone'] ) ? $c['phone'] : '',
			'Événement' => isset( $c['event_date'] ) ? $c['event_date'] : '',
			'Quantité'  => isset( $c['quantity'] ) ? $c['quantity'] : '',
			'Message'   => isset( $c['message'] ) ? $c['message'] : '',
		);
		foreach ( $rows as $k => $v ) {
			echo '<tr><th style="width:140px">' . esc_html( $k ) . '</th><td>' . nl2br( esc_html( (string) $v ) ) . '</td></tr>';
		}
		echo '</tbody></table>';
		echo '<h4>Configuration</h4><pre style="white-space:pre-wrap;background:#f6f7f7;padding:12px">' . esc_html( $sum ) . '</pre>';
		echo '<details><summary>Fichier projet (JSON)</summary><pre style="max-height:400px;overflow:auto;background:#f6f7f7;padding:12px">' . esc_html( (string) wp_json_encode( json_decode( $cfg, true ), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) ) . '</pre></details>';
	}

	public static function box_status( $post ) {
		wp_nonce_field( 'sk_status', 'sk_status_nonce' );
		$cur = get_post_meta( $post->ID, '_sk_status', true );
		echo '<select name="sk_status" style="width:100%">';
		foreach ( self::STATUSES as $k => $label ) {
			echo '<option value="' . esc_attr( $k ) . '"' . selected( $cur, $k, false ) . '>' . esc_html( $label ) . '</option>';
		}
		echo '</select><p class="description">Enregistrez avec « Mettre à jour ».</p>';
		$order_id = (int) get_post_meta( $post->ID, '_sk_order', true );
		if ( $order_id && function_exists( 'wc_get_order' ) && ( $order = wc_get_order( $order_id ) ) ) {
			echo '<p><a class="button" href="' . esc_url( $order->get_edit_order_url() ) . '">Commande WooCommerce n° ' . esc_html( $order_id ) . '</a></p>';
		}
	}

	public static function save_status( $post_id, $post ) {
		if ( ! isset( $_POST['sk_status_nonce'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['sk_status_nonce'] ) ), 'sk_status' ) ) {
			return;
		}
		if ( ! current_user_can( 'edit_post', $post_id ) || ! isset( $_POST['sk_status'] ) ) {
			return;
		}
		$st = sanitize_key( wp_unslash( $_POST['sk_status'] ) );
		if ( isset( self::STATUSES[ $st ] ) ) {
			update_post_meta( $post_id, '_sk_status', $st );
		}
	}

	public static function box_files( $post ) {
		$files  = (array) get_post_meta( $post->ID, '_sk_files', true );
		$labels = array( 'bat' => 'BAT (PDF)', 'bat_svg' => 'BAT (SVG)', 'logo' => 'Logo', 'logo_back' => 'Logo verso', 'pass_art' => 'Visuel du pass', 'preview' => 'Aperçu 3D' );
		if ( empty( $files ) ) {
			echo '<p>Aucun fichier joint.</p>';
			return;
		}
		if ( ! empty( $files['preview'] ) ) {
			echo '<img alt="" style="width:100%;background:#f6f7f7;border-radius:6px" src="' . esc_url( self::file_url( $post->ID, 'preview', true ) ) . '">';
		}
		echo '<ul>';
		foreach ( $files as $k => $f ) {
			echo '<li><a href="' . esc_url( self::file_url( $post->ID, $k ) ) . '">' . esc_html( isset( $labels[ $k ] ) ? $labels[ $k ] : $k ) . '</a> <span class="description">(' . esc_html( size_format( $f['size'] ) ) . ')</span></li>';
		}
		echo '</ul>';
	}

	private static function file_url( $post_id, $field, $inline = false ) {
		return wp_nonce_url( admin_url( 'admin-post.php?action=sklubs_quote_file&post=' . $post_id . '&f=' . $field . ( $inline ? '&inline=1' : '' ) ), 'sk_file_' . $post_id );
	}

	/** Téléchargement des fichiers réservé aux utilisateurs connectés autorisés. */
	public static function download() {
		$post_id = isset( $_GET['post'] ) ? absint( $_GET['post'] ) : 0;
		check_admin_referer( 'sk_file_' . $post_id );
		if ( ! current_user_can( 'edit_post', $post_id ) ) {
			wp_die( 'Accès refusé.', 403 );
		}
		$field = isset( $_GET['f'] ) ? sanitize_key( $_GET['f'] ) : '';
		$files = (array) get_post_meta( $post_id, '_sk_files', true );
		if ( empty( $files[ $field ] ) || ! is_readable( $files[ $field ]['path'] ) ) {
			wp_die( 'Fichier introuvable.', 404 );
		}
		$f      = $files[ $field ];
		$inline = ! empty( $_GET['inline'] ) && in_array( $f['mime'], array( 'image/png', 'image/jpeg' ), true );
		nocache_headers();
		header( 'Content-Type: ' . $f['mime'] );
		header( 'Content-Length: ' . filesize( $f['path'] ) );
		header( 'X-Content-Type-Options: nosniff' );
		header( 'Content-Disposition: ' . ( $inline ? 'inline' : 'attachment' ) . '; filename="' . $f['name'] . '"' );
		readfile( $f['path'] );
		exit;
	}

	public static function admin_menu() {
		add_submenu_page( 'edit.php?post_type=' . self::CPT, 'Réglages', 'Réglages', 'manage_options', 'sklubs-quotes-settings', array( __CLASS__, 'settings_page' ) );
	}

	public static function register_settings() {
		register_setting(
			'sklubs_quotes',
			Sklubs_Event_Woo::PRICING_OPT,
			array(
				'sanitize_callback' => function ( $v ) {
					$v = trim( wp_unslash( (string) $v ) );
					if ( '' === $v ) {
						return '';
					}
					$d = json_decode( $v, true );
					if ( ! is_array( $d ) ) {
						add_settings_error( 'sklubs_quotes', 'sk_pricing', 'Grille de prix : JSON invalide, ancienne grille conservée.' );
						return get_option( Sklubs_Event_Woo::PRICING_OPT, '' );
					}
					return wp_json_encode( $d, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES );
				},
			)
		);
		register_setting(
			'sklubs_quotes',
			self::OPTION,
			array(
				'sanitize_callback' => function ( $v ) {
					return array(
						'recipients'     => sanitize_text_field( isset( $v['recipients'] ) ? $v['recipients'] : '' ),
						'origins'        => sanitize_textarea_field( isset( $v['origins'] ) ? $v['origins'] : '' ),
						'confirm_client' => empty( $v['confirm_client'] ) ? 0 : 1,
						'configurator'   => esc_url_raw( isset( $v['configurator'] ) ? $v['configurator'] : '' ),
					);
				},
			)
		);
	}

	public static function settings_page() {
		$s   = self::settings();
		$opt = self::OPTION;
		?>
		<div class="wrap">
			<h1>Devis Event — réglages</h1>
			<form method="post" action="options.php">
				<?php settings_fields( 'sklubs_quotes' ); ?>
				<table class="form-table" role="presentation">
					<tr><th><label for="sk-r">E-mails qui reçoivent les devis</label></th>
						<td><input id="sk-r" class="regular-text" name="<?php echo esc_attr( $opt ); ?>[recipients]" value="<?php echo esc_attr( $s['recipients'] ); ?>"><p class="description">Plusieurs adresses : séparez-les par une virgule.</p></td></tr>
					<tr><th><label for="sk-o">Sites autorisés à envoyer des devis</label></th>
						<td><textarea id="sk-o" class="large-text" rows="3" name="<?php echo esc_attr( $opt ); ?>[origins]"><?php echo esc_textarea( $s['origins'] ); ?></textarea><p class="description">Une adresse par ligne, sans « / » final.</p></td></tr>
					<tr><th>Accusé de réception</th>
						<td><label><input type="checkbox" name="<?php echo esc_attr( $opt ); ?>[confirm_client]" value="1" <?php checked( $s['confirm_client'], 1 ); ?>> Envoyer un e-mail de confirmation au client</label></td></tr>
					<tr><th><label for="sk-c">Adresse du configurateur</label></th>
						<td><input id="sk-c" class="regular-text" name="<?php echo esc_attr( $opt ); ?>[configurator]" value="<?php echo esc_attr( $s['configurator'] ); ?>"><p class="description">Utilisée par le bouton <code>[sklubs_lanyard_button]</code>.</p></td></tr>
					<tr><th><label for="sk-p">Grille de prix (HT)</label></th>
						<td><textarea id="sk-p" class="large-text code" rows="18" name="<?php echo esc_attr( Sklubs_Event_Woo::PRICING_OPT ); ?>"><?php echo esc_textarea( get_option( Sklubs_Event_Woo::PRICING_OPT ) ? get_option( Sklubs_Event_Woo::PRICING_OPT ) : Sklubs_Event_Woo::PRICING_TEMPLATE ); ?></textarea>
						<p class="description">Remplacez les <code>null</code> par vos prix HT unitaires (ex. <code>0.85</code>), le MOQ et les remises (<code>[{"min": 1000, "discount": 0.1}]</code>).
						Tant qu'un prix manque, le configurateur affiche « Sur devis » ; quand tout est rempli, il affiche le prix et le bouton « Ajouter au panier ». Le prix est recalculé ici, jamais repris du navigateur.</p></td></tr>
					<tr><th>WooCommerce</th>
						<td><?php echo Sklubs_Event_Woo::active() ? 'Actif : chaque devis crée une commande « Devis demandé ».' : 'Non détecté : les devis sont seulement enregistrés ici.'; ?></td></tr>
				</table>
				<?php submit_button(); ?>
			</form>
			<p>Test de l'API : <a href="<?php echo esc_url( rest_url( 'sklubs/v1/ping' ) ); ?>" target="_blank" rel="noopener"><?php echo esc_html( rest_url( 'sklubs/v1/ping' ) ); ?></a></p>
		</div>
		<?php
	}

	/* ------------------------------------------------------------------ bouton pour les pages sklubs.fr */

	/** [sklubs_lanyard_button text="Configurer mon lanyard"] */
	public static function shortcode( $atts ) {
		$a = shortcode_atts( array( 'text' => 'Configurer mon lanyard en 3D' ), $atts );
		return '<a class="sklubs-lanyard-btn" href="' . esc_url( self::settings()['configurator'] ) . '" style="display:inline-flex;align-items:center;gap:10px;padding:16px 26px;border-radius:10px;background:#FF6A00;color:#fff;font-weight:700;letter-spacing:.04em;text-transform:uppercase;text-decoration:none">' . esc_html( $a['text'] ) . ' <span aria-hidden="true">→</span></a>';
	}
}

Sklubs_Event_Quotes::init();
Sklubs_Event_Woo::init();
