import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function upsertProduct(input: {
  sku: string;
  slug: string;
  name: string;
  description: string;
  category: 'JEWELLERY' | 'COIN' | 'BAR';
  metal: 'GOLD' | 'SILVER';
  images: string[];
  variants: Array<{
    sku: string;
    purityLabel: string;
    purityFraction: number;
    netWeightGrams: number;
    makingChargeType: 'FLAT' | 'PERCENT_OF_METAL';
    makingChargeValue: number;
    stoneChargeAmount?: number;
    stockQuantity: number;
    images?: string[];
  }>;
}) {
  const product = await prisma.product.upsert({
    where: { slug: input.slug },
    update: {
      name: input.name,
      description: input.description,
      category: input.category,
      metal: input.metal,
      images: input.images,
    },
    create: {
      sku: input.sku,
      slug: input.slug,
      name: input.name,
      description: input.description,
      category: input.category,
      metal: input.metal,
      images: input.images,
    },
  });

  for (const v of input.variants) {
    await prisma.productVariant.upsert({
      where: { sku: v.sku },
      update: {
        purityLabel: v.purityLabel,
        purityFraction: v.purityFraction,
        netWeightGrams: v.netWeightGrams,
        makingChargeType: v.makingChargeType,
        makingChargeValue: v.makingChargeValue,
        stoneChargeAmount: v.stoneChargeAmount ?? 0,
        images: v.images ?? [],
      },
      create: {
        productId: product.id,
        sku: v.sku,
        purityLabel: v.purityLabel,
        purityFraction: v.purityFraction,
        netWeightGrams: v.netWeightGrams,
        makingChargeType: v.makingChargeType,
        makingChargeValue: v.makingChargeValue,
        stoneChargeAmount: v.stoneChargeAmount ?? 0,
        stockQuantity: v.stockQuantity,
        images: v.images ?? [],
      },
    });
  }

  return product;
}

async function main() {
  console.log('Seeding demonstration data (safe to re-run: uses upsert)...');

  // Store settings (demo defaults; must be reviewed before accepting real payments).
  await prisma.storeSetting.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      storeName: 'GoldSilverShop',
      currency: 'INR',
      currencySymbol: '\u20b9',
      taxPercent: 3.0,
      shippingFlatFee: 150.0,
      freeShippingThreshold: 50000.0,
      isDemoMode: true,
    },
  });

  // Manually entered metal rates (not live market data) — admins should update via the admin dashboard.
  await prisma.metalRate.create({ data: { metal: 'GOLD', ratePerGram: 6500.0, source: 'Manually entered by admin (seed data)' } });
  await prisma.metalRate.create({ data: { metal: 'SILVER', ratePerGram: 82.0, source: 'Manually entered by admin (seed data)' } });

  await upsertProduct({
    sku: 'GJ-RING-001',
    slug: 'classic-gold-band-ring',
    name: 'Classic Gold Band Ring',
    description: 'A timeless polished gold band, handcrafted for everyday elegance. Available in 18K and 22K purity.',
    category: 'JEWELLERY',
    metal: 'GOLD',
    images: ['/products/gold-ring.svg'],
    variants: [
      { sku: 'GJ-RING-001-18K', purityLabel: '18K', purityFraction: 0.75, netWeightGrams: 4.2, makingChargeType: 'PERCENT_OF_METAL', makingChargeValue: 12, stockQuantity: 15 },
      { sku: 'GJ-RING-001-22K', purityLabel: '22K', purityFraction: 0.9167, netWeightGrams: 4.5, makingChargeType: 'PERCENT_OF_METAL', makingChargeValue: 10, stockQuantity: 10 },
    ],
  });

  await upsertProduct({
    sku: 'GJ-NECK-002',
    slug: 'gold-leaf-pendant-necklace',
    name: 'Gold Leaf Pendant Necklace',
    description: 'Delicate leaf-shaped pendant on a fine gold chain, finished with a subtle textured surface.',
    category: 'JEWELLERY',
    metal: 'GOLD',
    images: ['/products/gold-necklace.svg'],
    variants: [
      { sku: 'GJ-NECK-002-22K', purityLabel: '22K', purityFraction: 0.9167, netWeightGrams: 6.8, makingChargeType: 'PERCENT_OF_METAL', makingChargeValue: 14, stoneChargeAmount: 500, stockQuantity: 8 },
    ],
  });

  await upsertProduct({
    sku: 'SJ-EARR-003',
    slug: 'silver-drop-earrings',
    name: 'Silver Drop Earrings',
    description: 'Lightweight sterling silver drop earrings with a mirror-polished finish.',
    category: 'JEWELLERY',
    metal: 'SILVER',
    images: ['/products/silver-earrings.svg'],
    variants: [
      { sku: 'SJ-EARR-003-925', purityLabel: '92.5% (Sterling)', purityFraction: 0.925, netWeightGrams: 5.5, makingChargeType: 'PERCENT_OF_METAL', makingChargeValue: 18, stockQuantity: 25 },
    ],
  });

  await upsertProduct({
    sku: 'SJ-BANG-004',
    slug: 'silver-oxidised-bangle',
    name: 'Silver Oxidised Bangle',
    description: 'Traditional oxidised silver bangle with hand-etched detailing.',
    category: 'JEWELLERY',
    metal: 'SILVER',
    images: ['/products/silver-bangle.svg'],
    variants: [
      { sku: 'SJ-BANG-004-925', purityLabel: '92.5% (Sterling)', purityFraction: 0.925, netWeightGrams: 18.0, makingChargeType: 'PERCENT_OF_METAL', makingChargeValue: 15, stockQuantity: 12 },
    ],
  });

  await upsertProduct({
    sku: 'GC-COIN-005',
    slug: 'gold-coin-sovereign',
    name: 'Gold Sovereign Coin',
    description: 'Investment-grade 24K gold coin, available in multiple weights, ideal for gifting or savings.',
    category: 'COIN',
    metal: 'GOLD',
    images: ['/products/gold-coin.svg'],
    variants: [
      { sku: 'GC-COIN-005-1G', purityLabel: '24K', purityFraction: 0.999, netWeightGrams: 1.0, makingChargeType: 'FLAT', makingChargeValue: 150, stockQuantity: 40 },
      { sku: 'GC-COIN-005-5G', purityLabel: '24K', purityFraction: 0.999, netWeightGrams: 5.0, makingChargeType: 'FLAT', makingChargeValue: 300, stockQuantity: 20 },
      { sku: 'GC-COIN-005-10G', purityLabel: '24K', purityFraction: 0.999, netWeightGrams: 10.0, makingChargeType: 'FLAT', makingChargeValue: 450, stockQuantity: 1 },
    ],
  });

  await upsertProduct({
    sku: 'SC-COIN-006',
    slug: 'silver-coin-fine',
    name: 'Fine Silver Coin',
    description: '999 fine silver coin, a popular choice for gifting during festivals and ceremonies.',
    category: 'COIN',
    metal: 'SILVER',
    images: ['/products/silver-coin.svg'],
    variants: [
      { sku: 'SC-COIN-006-10G', purityLabel: '999', purityFraction: 0.999, netWeightGrams: 10.0, makingChargeType: 'FLAT', makingChargeValue: 40, stockQuantity: 60 },
      { sku: 'SC-COIN-006-50G', purityLabel: '999', purityFraction: 0.999, netWeightGrams: 50.0, makingChargeType: 'FLAT', makingChargeValue: 120, stockQuantity: 25 },
    ],
  });

  await upsertProduct({
    sku: 'GB-BAR-007',
    slug: 'gold-bullion-bar',
    name: 'Gold Bullion Bar',
    description: '24K refined gold bar with assay certification markings, ideal for long-term investment.',
    category: 'BAR',
    metal: 'GOLD',
    images: ['/products/gold-bar.svg'],
    variants: [
      { sku: 'GB-BAR-007-10G', purityLabel: '24K', purityFraction: 0.999, netWeightGrams: 10.0, makingChargeType: 'FLAT', makingChargeValue: 400, stockQuantity: 15 },
      { sku: 'GB-BAR-007-100G', purityLabel: '24K', purityFraction: 0.999, netWeightGrams: 100.0, makingChargeType: 'FLAT', makingChargeValue: 1500, stockQuantity: 5 },
    ],
  });

  await upsertProduct({
    sku: 'SB-BAR-008',
    slug: 'silver-bullion-bar',
    name: 'Silver Bullion Bar',
    description: '999 fine silver bar, refined and hallmarked for investment purposes.',
    category: 'BAR',
    metal: 'SILVER',
    images: ['/products/silver-bar.svg'],
    variants: [
      { sku: 'SB-BAR-008-100G', purityLabel: '999', purityFraction: 0.999, netWeightGrams: 100.0, makingChargeType: 'FLAT', makingChargeValue: 250, stockQuantity: 10 },
      { sku: 'SB-BAR-008-500G', purityLabel: '999', purityFraction: 0.999, netWeightGrams: 500.0, makingChargeType: 'FLAT', makingChargeValue: 900, stockQuantity: 0 },
    ],
  });

  // Secure initial administrator: only created if credentials are supplied via env vars, and only once.
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail.toLowerCase() } });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await prisma.user.create({
        data: { email: adminEmail.toLowerCase(), name: 'Store Administrator', passwordHash, role: 'ADMIN' },
      });
      console.log(`Administrator account created for ${adminEmail}.`);
    } else {
      console.log('Administrator account already exists; skipping creation.');
    }
  } else {
    console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping administrator bootstrap. Set them and re-run `npm run seed` to create the first admin.');
  }

  console.log('Seeding complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
