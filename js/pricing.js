// Règles de compatibilité + prix, pilotés uniquement par product.json.
// Aucune valeur n'est inventée : tant qu'un champ vaut null / "TO_DEFINE",
// le statut renvoyé est « factory » (validation usine requise).

const isDefined = (v) => v !== null && v !== undefined && v !== 'TO_DEFINE' && !Number.isNaN(v);

export const modelOf = (product, id) => product.models.find((m) => m.id === id);

export function allowedMethods(product, materialId) {
  const ids = product.rules.methodsByMaterial[materialId] || [];
  return product.printingMethods.filter((m) => ids.includes(m.id));
}

export function allowedAttachments(product, modelId) {
  const pose = modelOf(product, modelId).pose;
  const ids = product.rules.attachmentsByPose[pose] || [];
  return product.attachments.filter((a) => ids.includes(a.id));
}

export const canHoldBadge = (product, cfg) =>
  modelOf(product, cfg.model).pose === 'neck' && product.rules.holderNeedsAttachment.includes(cfg.attachment);

// Corrige une configuration pour qu'elle reste toujours faisable.
export function sanitize(product, cfg) {
  const model = modelOf(product, cfg.model);
  if (!model.materials.includes(cfg.material)) cfg.material = model.defaultMaterial;
  if (!model.widths.includes(cfg.width)) cfg.width = model.defaultWidth;
  const [minL, maxL] = model.customLength;
  if (!model.lengths.includes(cfg.length) && !(cfg.customLength && cfg.length >= minL && cfg.length <= maxL)) {
    cfg.length = model.defaultLength; cfg.customLength = false;
  }
  const methods = allowedMethods(product, cfg.material).map((m) => m.id);
  if (!methods.includes(cfg.method)) cfg.method = methods.includes(model.defaultMethod) ? model.defaultMethod : methods[0];
  const atts = allowedAttachments(product, cfg.model).map((a) => a.id);
  if (!atts.includes(cfg.attachment)) cfg.attachment = model.defaultAttachment && atts.includes(model.defaultAttachment) ? model.defaultAttachment : atts[0];
  if (model.pose !== 'neck' || product.off?.breakaway) cfg.breakaway = 'none';
  if (product.off?.buckle) cfg.buckle = 'none';
  if (product.off?.pass && cfg.kit === 'pass') cfg.kit = 'holder';
  if (!product.finishes.some((f) => f.id === cfg.finish)) cfg.finish = product.finishes[0]?.id;
  if (cfg.hardwareColor !== 'custom' && !product.hardwareColors.some((h) => h.id === cfg.hardwareColor)) cfg.hardwareColor = product.hardwareColors[0]?.id;
  if (!product.holders.some((h) => h.id === cfg.holder)) cfg.holder = product.holders.find((h) => h.id !== 'none')?.id || 'none';
  if (!canHoldBadge(product, cfg)) cfg.kit = 'lanyard';
  if (cfg.kit !== 'lanyard' && cfg.holder === 'none') cfg.holder = product.holders.find((h) => h.id !== 'none')?.id || 'none';
  if (cfg.kit !== 'lanyard' && cfg.holder === 'none') cfg.kit = 'lanyard';
  return cfg;
}

export function computePrice(product, cfg, qtyOverride) {
  const p = product.pricing || {};
  const qty = Math.max(1, Math.round(qtyOverride ?? cfg.quantity ?? 0));
  const reasons = [];
  const need = (label, v) => { if (!isDefined(v)) { reasons.push(label); return 0; } return Number(v); };

  let unit = need('prix de base', p.basePriceByModel?.[cfg.model]);
  unit += need('supplément largeur', p.widthSurcharge?.[cfg.width]);
  const base = modelOf(product, cfg.model).defaultLength;
  if (cfg.length !== base) unit += need('supplément longueur', p.lengthSurchargePer100mm) * ((cfg.length - base) / 100);
  unit += need('supplément matière', p.materialSurcharge?.[cfg.material]);
  unit += need('supplément impression', p.methodSurcharge?.[cfg.method]);
  if (cfg.backMode !== 'none') unit += need('impression verso', p.backPrintSurcharge);
  unit += need('breakaway', p.breakawaySurcharge?.[cfg.breakaway]);
  unit += need('boucle', p.buckleSurcharge?.[cfg.buckle]);
  unit += need('attache', p.attachmentSurcharge?.[cfg.attachment]);
  if (cfg.kit !== 'lanyard') unit += need('porte-badge', p.holderSurcharge?.[cfg.holder]);
  if (cfg.kit === 'pass') unit += need('pass imprimé', p.passPrintSurcharge);
  const setup = need('frais de calage', p.setupFee?.[cfg.method]);

  const moq = product.quantity?.moq;
  if (!isDefined(moq)) reasons.push('MOQ');
  const belowMoq = isDefined(moq) && qty < Number(moq);

  let discount = 0;
  if (Array.isArray(p.quantityDiscounts)) for (const t of p.quantityDiscounts) if (qty >= t.min) discount = t.discount;

  const u = unit * (1 - discount) + setup / qty;
  const factory = reasons.length > 0 || belowMoq;
  return {
    status: factory ? 'factory' : p.priceMode === 'estimated' ? 'estimated' : 'instant',
    reasons: [...new Set(reasons)],
    belowMoq,
    quantity: qty,
    unit: factory ? null : u,
    total: factory ? null : u * qty,
    currency: p.currency || 'EUR',
  };
}
