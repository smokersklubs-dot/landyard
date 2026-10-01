<?php
/**
 * Page « Options » (Devis Event → Options) : cocher / décocher ce que le configurateur propose.
 * Une option décochée disparaît du configurateur. Enregistré dans l'option `sklubs_event_catalog`
 * sous la forme {"disabled": {"models": [...], "colors": [...], ...}} et servi par /sklubs/v1/pricing.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Sklubs_Event_Options_Page {

	const SLUG   = 'sklubs-quotes-options';
	const OPTION = 'sklubs_event_catalog';

	/** Mêmes identifiants que products/lanyard/product.json. */
	const GROUPS = array(
		'models'          => array( 'Modèles', array( 'classic' => 'Lanyard Classic', 'sublimation' => 'Lanyard Sublimation', 'woven' => 'Lanyard Tissé', 'tubular' => 'Lanyard Tubulaire', 'rpet' => 'Lanyard RPET', 'phone' => 'Phone Lanyard', 'wrist' => 'Wrist strap (porte-clés)' ) ),
		'materials'       => array( 'Matières', array( 'polyester' => 'Polyester', 'satin' => 'Satin', 'rpet' => 'RPET', 'woven' => 'Tissé (woven)', 'bamboo' => 'Bambou', 'tubular' => 'Tubulaire' ) ),
		'colors'          => array( 'Couleurs du ruban', array( 'black' => 'Noir|#141414', 'orange' => 'Orange SKLUBS|#FF6A00', 'white' => 'Blanc|#F4F4F2', 'silver' => 'Gris clair|#C9CBCC', 'steel' => 'Gris bleu|#8C9BAA', 'blue' => 'Bleu|#3E7FC1', 'pink' => 'Rose|#EE7FB4', 'graphite' => 'Graphite|#3B3D40', 'sage' => 'Vert sauge|#7E9A7A', 'olive' => 'Olive|#6F7A4A', 'navy' => 'Marine|#1C2A44', 'red' => 'Rouge|#C8102E' ) ),
		'printingMethods' => array( "Techniques d'impression", array( 'screen' => 'Sérigraphie', 'sublimation' => 'Sublimation', 'woven' => 'Tissage' ) ),
		'finishes'        => array( 'Finitions', array( 'matte' => 'Mate', 'satin' => 'Satin', 'gloss' => 'Brillante' ) ),
		'attachments'     => array( 'Attaches', array( 'snaphook' => 'Mousqueton', 'swivel' => 'Crochet tournant', 'plasticclip' => 'Clip plastique', 'keyring' => 'Anneau', 'double' => 'Double attache', 'phone' => 'Patch téléphone', 'none' => 'Sans attache' ) ),
		'holders'         => array( 'Porte-badges', array( 'pvcsoft' => 'PVC souple', 'pvcrigid' => 'PVC rigide', 'leather' => 'Cuir' ) ),
		'hardwareColors'  => array( 'Couleur des attaches', array( 'chrome' => 'Métal', 'black' => 'Noir', 'white' => 'Blanc', 'orange' => 'Orange' ) ),
		'extras'          => array( 'Options', array( 'breakaway' => 'Safety breakaway', 'buckle' => 'Boucle détachable', 'pass' => 'Pass imprimé', 'customColor' => 'Couleur personnalisée (HEX)' ) ),
	);

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ), 12 );
		add_action( 'admin_post_sklubs_save_options', array( __CLASS__, 'save' ) );
	}

	public static function catalog() {
		$c = json_decode( (string) get_option( self::OPTION, '' ), true );
		if ( ! is_array( $c ) || ! isset( $c['disabled'] ) || ! is_array( $c['disabled'] ) ) {
			$c = array( 'disabled' => array() );
		}
		return $c;
	}

	public static function menu() {
		add_submenu_page( 'edit.php?post_type=' . Sklubs_Event_Quotes::CPT, 'Options', 'Options', 'manage_options', self::SLUG, array( __CLASS__, 'render' ) );
	}

	public static function render() {
		$off = self::catalog()['disabled'];
		?>
		<div class="wrap">
			<h1>Options du configurateur Lanyard</h1>
			<?php if ( isset( $_GET['saved'] ) ) : ?><div class="notice notice-success"><p>Options enregistrées. Le configurateur est à jour.</p></div><?php endif; ?>
			<?php if ( isset( $_GET['kept'] ) ) : ?><div class="notice notice-warning"><p>Au moins un choix doit rester coché dans chaque groupe : le premier a été gardé.</p></div><?php endif; ?>
			<div class="notice notice-info inline"><p><strong>Comment ça marche :</strong> coché = proposé aux clients, décoché = caché dans le configurateur.
				Pratique pour retirer une couleur en rupture ou une matière que l'usine ne fait plus. Rien n'est supprimé : recochez pour la remettre.</p></div>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="sklubs_save_options">
				<?php wp_nonce_field( 'sklubs_options' ); ?>
				<?php foreach ( self::GROUPS as $group => $g ) : ?>
					<h2><?php echo esc_html( $g[0] ); ?></h2>
					<fieldset style="display:flex;flex-wrap:wrap;gap:10px 22px;margin-bottom:8px">
						<?php
						foreach ( $g[1] as $id => $label ) :
							$parts = explode( '|', $label );
							$on    = ! in_array( $id, isset( $off[ $group ] ) ? (array) $off[ $group ] : array(), true );
							?>
							<label style="display:flex;align-items:center;gap:8px;min-width:200px">
								<input type="checkbox" name="on[<?php echo esc_attr( $group ); ?>][]" value="<?php echo esc_attr( $id ); ?>" <?php checked( $on ); ?>>
								<?php if ( isset( $parts[1] ) ) : ?><span style="width:18px;height:18px;border-radius:50%;background:<?php echo esc_attr( $parts[1] ); ?>;box-shadow:inset 0 0 0 1px rgba(0,0,0,.2)"></span><?php endif; ?>
								<?php echo esc_html( $parts[0] ); ?>
							</label>
						<?php endforeach; ?>
					</fieldset>
				<?php endforeach; ?>
				<?php submit_button( 'Enregistrer les options' ); ?>
			</form>
		</div>
		<?php
	}

	public static function save() {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( 'Accès refusé.', 403 );
		}
		check_admin_referer( 'sklubs_options' );
		$on       = isset( $_POST['on'] ) && is_array( $_POST['on'] ) ? wp_unslash( $_POST['on'] ) : array(); // phpcs:ignore
		$disabled = array();
		$kept     = false;
		foreach ( self::GROUPS as $group => $g ) {
			$all     = array_keys( $g[1] );
			$checked = array_values( array_intersect( $all, array_map( 'sanitize_key', isset( $on[ $group ] ) ? (array) $on[ $group ] : array() ) ) );
			// Un groupe ne peut pas être vide (sauf les options facultatives).
			if ( ! $checked && ! in_array( $group, array( 'extras', 'holders' ), true ) ) {
				$checked = array( $all[0] );
				$kept    = true;
			}
			$off = array_values( array_diff( $all, $checked ) );
			if ( $off ) {
				$disabled[ $group ] = $off;
			}
		}
		update_option( self::OPTION, wp_json_encode( array( 'disabled' => $disabled ) ) );
		wp_safe_redirect( admin_url( 'edit.php?post_type=' . Sklubs_Event_Quotes::CPT . '&page=' . self::SLUG . '&saved=1' . ( $kept ? '&kept=1' : '' ) ) );
		exit;
	}
}
