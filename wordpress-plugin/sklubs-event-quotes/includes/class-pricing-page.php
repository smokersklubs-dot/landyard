<?php
/**
 * Page « Prix » (Devis Event → Prix) : la grille de prix sous forme de tableau simple,
 * une case par prix. Case vide = prix pas encore connu → le configurateur affiche « Sur devis ».
 * La grille est enregistrée dans la même option que celle lue par Sklubs_Event_Woo::pricing().
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sklubs_Event_Pricing_Page {

	const SLUG = 'sklubs-quotes-pricing';

	/** Libellés lisibles des sections et des options. */
	const SECTIONS = array(
		'basePriceByModel'    => array( 'Prix de base par modèle', 'Prix HT d\'un lanyard, sans option.', array( 'classic' => 'Lanyard Classic', 'sublimation' => 'Lanyard Sublimation', 'woven' => 'Lanyard Tissé', 'tubular' => 'Lanyard Tubulaire', 'rpet' => 'Lanyard RPET', 'phone' => 'Phone Lanyard', 'wrist' => 'Wrist strap (porte-clés)' ) ),
		'widthSurcharge'      => array( 'Supplément par largeur', '0 si la largeur ne change pas le prix.', array( '8' => '8 mm', '10' => '10 mm', '12' => '12 mm', '15' => '15 mm', '20' => '20 mm', '25' => '25 mm' ) ),
		'materialSurcharge'   => array( 'Supplément par matière', '', array( 'polyester' => 'Polyester', 'satin' => 'Satin', 'rpet' => 'RPET', 'woven' => 'Tissé (woven)', 'bamboo' => 'Bambou', 'tubular' => 'Tubulaire' ) ),
		'methodSurcharge'     => array( 'Supplément par impression', '', array( 'screen' => 'Sérigraphie', 'sublimation' => 'Sublimation', 'woven' => 'Tissage' ) ),
		'attachmentSurcharge' => array( 'Supplément par attache', '', array( 'snaphook' => 'Mousqueton', 'swivel' => 'Crochet tournant', 'plasticclip' => 'Clip plastique', 'keyring' => 'Anneau', 'double' => 'Double attache', 'phone' => 'Patch téléphone', 'none' => 'Sans attache' ) ),
		'breakawaySurcharge'  => array( 'Safety breakaway', '', array( 'none' => 'Sans', 'safety' => 'Avec breakaway' ) ),
		'buckleSurcharge'     => array( 'Boucle détachable', '', array( 'none' => 'Sans', 'detachable' => 'Avec boucle' ) ),
		'holderSurcharge'     => array( 'Porte-badge', '', array( 'none' => 'Sans', 'pvcsoft' => 'PVC souple', 'pvcrigid' => 'PVC rigide', 'leather' => 'Cuir' ) ),
		'setupFee'            => array( 'Frais de calage (une fois par commande)', 'Montant total, réparti automatiquement sur les pièces.', array( 'screen' => 'Sérigraphie', 'sublimation' => 'Sublimation', 'woven' => 'Tissage' ) ),
	);

	const SINGLES = array(
		'moq'                     => array( 'Quantité minimum (MOQ)', 'pièces' ),
		'lengthSurchargePer100mm' => array( 'Supplément longueur, par 10 cm de plus', '€ HT' ),
		'backPrintSurcharge'      => array( 'Impression au verso', '€ HT / pièce' ),
		'passPrintSurcharge'      => array( 'Pass imprimé (carte)', '€ HT / pièce' ),
	);

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ), 11 );
		add_action( 'admin_post_sklubs_save_pricing', array( __CLASS__, 'save' ) );
	}

	public static function menu() {
		add_submenu_page( 'edit.php?post_type=' . Sklubs_Event_Quotes::CPT, 'Prix', 'Prix', 'manage_options', self::SLUG, array( __CLASS__, 'render' ) );
	}

	private static function value( $v ) {
		return ( null === $v || '' === $v ) ? '' : rtrim( rtrim( number_format( (float) $v, 4, ',', '' ), '0' ), ',' );
	}

	private static function field( $name, $v, $suffix = '€ HT' ) {
		return '<input type="text" inputmode="decimal" style="width:110px" name="' . esc_attr( $name ) . '" value="' . esc_attr( self::value( $v ) ) . '" placeholder="à définir"> <span class="description">' . esc_html( $suffix ) . '</span>';
	}

	public static function render() {
		$p     = Sklubs_Event_Woo::pricing();
		$miss  = 0;
		$total = 0;
		foreach ( self::SECTIONS as $key => $sec ) {
			foreach ( $sec[2] as $k => $label ) {
				$total++;
				if ( ! isset( $p[ $key ][ $k ] ) || '' === $p[ $key ][ $k ] || null === $p[ $key ][ $k ] ) {
					$miss++;
				}
			}
		}
		?>
		<div class="wrap">
			<h1>Prix du configurateur Lanyard</h1>
			<?php if ( isset( $_GET['saved'] ) ) : ?><div class="notice notice-success"><p>Prix enregistrés. Le configurateur les utilise immédiatement.</p></div><?php endif; ?>
			<div class="notice notice-info inline"><p>
				<strong>Comment ça marche :</strong> tapez les prix HT en euros (virgule ou point, ex. <code>0,85</code>).
				Laissez une case <strong>vide</strong> si vous ne connaissez pas encore le prix : les clients verront « Sur devis » pour les configurations concernées.
				Quand toutes les cases utiles sont remplies, le bouton « Ajouter au panier » apparaît.
				<br>Cases encore vides : <strong><?php echo (int) $miss; ?> / <?php echo (int) $total; ?></strong>.
			</p></div>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="sklubs_save_pricing">
				<?php wp_nonce_field( 'sklubs_pricing' ); ?>
				<h2>Réglages généraux</h2>
				<table class="form-table" role="presentation">
					<?php foreach ( self::SINGLES as $key => $d ) : ?>
						<tr><th><?php echo esc_html( $d[0] ); ?></th><td><?php echo self::field( 'p[' . $key . ']', isset( $p[ $key ] ) ? $p[ $key ] : null, $d[1] ); // phpcs:ignore ?></td></tr>
					<?php endforeach; ?>
				</table>
				<?php foreach ( self::SECTIONS as $key => $sec ) : ?>
					<h2><?php echo esc_html( $sec[0] ); ?></h2>
					<?php if ( $sec[1] ) : ?><p class="description"><?php echo esc_html( $sec[1] ); ?></p><?php endif; ?>
					<table class="form-table" role="presentation">
						<?php foreach ( $sec[2] as $k => $label ) : ?>
							<tr><th><?php echo esc_html( $label ); ?></th><td><?php echo self::field( 'p[' . $key . '][' . $k . ']', isset( $p[ $key ][ $k ] ) ? $p[ $key ][ $k ] : null ); // phpcs:ignore ?></td></tr>
						<?php endforeach; ?>
					</table>
				<?php endforeach; ?>
				<h2>Remises par quantité</h2>
				<p class="description">Exemple : à partir de 1 000 pièces, 8 % de remise. Laissez vide si pas de remise.</p>
				<table class="form-table" role="presentation">
					<?php
					$tiers = isset( $p['quantityDiscounts'] ) && is_array( $p['quantityDiscounts'] ) ? array_values( $p['quantityDiscounts'] ) : array();
					for ( $i = 0; $i < 4; $i++ ) :
						$t = isset( $tiers[ $i ] ) ? $tiers[ $i ] : array( 'min' => '', 'discount' => '' );
						?>
						<tr><th>Palier <?php echo (int) ( $i + 1 ); ?></th><td>
							à partir de <input type="number" min="1" style="width:110px" name="tiers[<?php echo (int) $i; ?>][min]" value="<?php echo esc_attr( $t['min'] ); ?>"> pièces :
							<input type="text" inputmode="decimal" style="width:70px" name="tiers[<?php echo (int) $i; ?>][pct]" value="<?php echo esc_attr( '' === $t['discount'] ? '' : self::value( $t['discount'] * 100 ) ); ?>"> % de remise
						</td></tr>
					<?php endfor; ?>
				</table>
				<?php submit_button( 'Enregistrer les prix' ); ?>
			</form>
		</div>
		<?php
	}

	private static function number( $v ) {
		$v = trim( str_replace( array( ' ', "\xc2\xa0", '€' ), '', (string) $v ) );
		if ( '' === $v ) {
			return null;
		}
		$v = str_replace( ',', '.', $v );
		return is_numeric( $v ) && (float) $v >= 0 ? (float) $v : null;
	}

	public static function save() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Accès refusé.', 403 );
		}
		check_admin_referer( 'sklubs_pricing' );
		$in = isset( $_POST['p'] ) && is_array( $_POST['p'] ) ? wp_unslash( $_POST['p'] ) : array(); // phpcs:ignore
		$p  = Sklubs_Event_Woo::pricing();
		foreach ( self::SINGLES as $key => $d ) {
			$p[ $key ] = self::number( isset( $in[ $key ] ) ? $in[ $key ] : '' );
		}
		if ( null !== $p['moq'] ) {
			$p['moq'] = (int) $p['moq'];
		}
		foreach ( self::SECTIONS as $key => $sec ) {
			foreach ( $sec[2] as $k => $label ) {
				$p[ $key ][ $k ] = self::number( isset( $in[ $key ][ $k ] ) ? $in[ $key ][ $k ] : '' );
			}
		}
		$tiers = array();
		foreach ( isset( $_POST['tiers'] ) && is_array( $_POST['tiers'] ) ? wp_unslash( $_POST['tiers'] ) : array() as $t ) { // phpcs:ignore
			$min = absint( isset( $t['min'] ) ? $t['min'] : 0 );
			$pct = self::number( isset( $t['pct'] ) ? $t['pct'] : '' );
			if ( $min > 0 && null !== $pct && $pct > 0 && $pct < 100 ) {
				$tiers[] = array( 'min' => $min, 'discount' => round( $pct / 100, 4 ) );
			}
		}
		usort( $tiers, function ( $a, $b ) {
			return $a['min'] - $b['min'];
		} );
		$p['quantityDiscounts'] = $tiers ? $tiers : null;
		update_option( Sklubs_Event_Woo::PRICING_OPT, wp_json_encode( $p, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) );
		wp_safe_redirect( admin_url( 'edit.php?post_type=' . Sklubs_Event_Quotes::CPT . '&page=' . self::SLUG . '&saved=1' ) );
		exit;
	}
}
