/**
 * Script to fix internships with invalid province foreign keys
 * This sets kode_provinsi to NULL for internships that reference non-existent provinces
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting fix for invalid province foreign keys...');

  // Find all internships with kode_provinsi that don't exist in provinces table
  const internshipsWithInvalidProvince = await prisma.$queryRaw<
    Array<{ id_posisi: string; kode_provinsi: string; nama_provinsi: string; nama_perusahaan: string }>
  >`
    SELECT i.id_posisi, i.kode_provinsi, i.nama_provinsi, i.nama_perusahaan
    FROM internships i
    WHERE i.kode_provinsi IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM provinces p 
        WHERE p.kode_propinsi = i.kode_provinsi
      )
  `;

  if (internshipsWithInvalidProvince.length === 0) {
    console.log('✓ No internships with invalid province foreign keys found.');
    return;
  }

  console.log(`Found ${internshipsWithInvalidProvince.length} internships with invalid province codes:`);
  
  // Group by invalid province code
  const groupedByProvince = internshipsWithInvalidProvince.reduce((acc, item) => {
    if (!acc[item.kode_provinsi]) {
      acc[item.kode_provinsi] = [];
    }
    acc[item.kode_provinsi].push(item);
    return acc;
  }, {} as Record<string, typeof internshipsWithInvalidProvince>);

  // Display summary
  console.log('\nInvalid province codes summary:');
  for (const [code, items] of Object.entries(groupedByProvince)) {
    console.log(`  - kode_provinsi '${code}': ${items.length} internships`);
    // Show first 2 examples
    items.slice(0, 2).forEach(item => {
      console.log(`    * ${item.id_posisi}: ${item.nama_perusahaan} (${item.nama_provinsi})`);
    });
  }

  console.log('\nFixing invalid province foreign keys...');

  // Set kode_provinsi to NULL for all internships with invalid province codes
  const result = await prisma.internship.updateMany({
    where: {
      kode_provinsi: {
        in: Object.keys(groupedByProvince),
      },
    },
    data: {
      kode_provinsi: null,
    },
  });

  console.log(`✓ Fixed ${result.count} internships by setting kode_provinsi to NULL`);
  console.log('\nNote: nama_provinsi field is kept for reference.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('\n✓ Script completed successfully.');
    process.exit(0);
  })
  .catch(async (e) => {
    console.error('\n✗ Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
