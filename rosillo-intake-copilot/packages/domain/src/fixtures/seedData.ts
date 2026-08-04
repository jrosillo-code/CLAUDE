import type { CustomerRecord, PolicyRecord } from '../types';

/**
 * Synthetic customers, policies, and insurers (spec section 14). All names,
 * identifiers, plates, and addresses are fictional. The five named customers
 * anchor the twelve starter cases; the rest are generated filler to reach the
 * minimum dataset sizes.
 */

export interface InsurerRecord {
  id: string;
  name: string;
}

export const SEED_INSURERS: InsurerRecord[] = [
  { id: 'INS-01', name: 'Aseguradora Boreal (sintética)' },
  { id: 'INS-02', name: 'Seguros Alcazaba (sintética)' },
  { id: 'INS-03', name: 'Mutua del Henares (sintética)' },
  { id: 'INS-04', name: 'Península Seguros (sintética)' },
  { id: 'INS-05', name: 'Compañía Levante (sintética)' },
  { id: 'INS-06', name: 'Seguros Finisterre (sintética)' },
  { id: 'INS-07', name: 'Aseguradora Meridiana (sintética)' },
  { id: 'INS-08', name: 'Grupo Asegurador Duero (sintético)' },
];

const NAMED_CUSTOMERS: CustomerRecord[] = [
  { id: 'CUST-0001', customerType: 'INDIVIDUAL', name: 'Laura Martin Vega', email: 'laura.martin@example.test', phone: '600111222', taxIdFake: '00000001A' },
  { id: 'CUST-0002', customerType: 'INDIVIDUAL', name: 'Diego Ruiz Soto', email: 'diego.ruiz@example.test', phone: '600333444', taxIdFake: '00000002B' },
  { id: 'CUST-0003', customerType: 'INDIVIDUAL', name: 'Marta Gil Pardo', email: 'marta.gil@example.test', phone: '600555666', taxIdFake: '00000003C' },
  { id: 'CUST-0004', customerType: 'COMPANY', name: 'Transportes Lince SL', email: 'operaciones@lince.test', phone: '910111222', taxIdFake: 'B0000004D' },
  { id: 'CUST-0005', customerType: 'COMPANY', name: 'Taller Norte SL', email: 'admin@tallernorte.test', phone: '910333444', taxIdFake: 'B0000005E' },
];

const NAMED_POLICIES: PolicyRecord[] = [
  { id: 'AUTO-000184', policyNumber: 'AUTO-000184', customerId: 'CUST-0001', insurerId: 'INS-01', product: 'Auto', status: 'ACTIVE', inceptionDate: '2023-10-12', renewalDate: '2026-10-12', premium: 642.5, riskSummary: 'Audi Q5 45 TFSI matrícula 1234-XYZ' },
  { id: 'HOME-000052', policyNumber: 'HOME-000052', customerId: 'CUST-0002', insurerId: 'INS-02', product: 'Hogar', status: 'ACTIVE', inceptionDate: '2022-09-01', renewalDate: '2026-09-01', premium: 289.9, riskSummary: 'Piso hogar Calle Ficción 12 Madrid' },
  { id: 'MOTO-000088', policyNumber: 'MOTO-000088', customerId: 'CUST-0003', insurerId: 'INS-03', product: 'Moto', status: 'PENDING_RENEWAL', inceptionDate: '2024-08-26', renewalDate: '2026-08-26', premium: 310.0, riskSummary: 'Honda CB650R matrícula 5678-ZYX' },
  { id: 'FLEET-000013', policyNumber: 'FLEET-000013', customerId: 'CUST-0004', insurerId: 'INS-04', product: 'Flota', status: 'ACTIVE', inceptionDate: '2021-11-15', renewalDate: '2026-11-15', premium: 8420.0, riskSummary: 'Flota 12 furgonetas comerciales logística' },
  { id: 'RC-000041', policyNumber: 'RC-000041', customerId: 'CUST-0005', insurerId: 'INS-05', product: 'RC Empresa', status: 'ACTIVE', inceptionDate: '2024-01-10', renewalDate: '2027-01-10', premium: 1150.0, riskSummary: 'Responsabilidad civil taller reparación vehículos' },
];

const FIRST = ['Ana', 'Pablo', 'Lucía', 'Javier', 'Elena', 'Sergio', 'Nuria', 'Andrés', 'Isabel', 'Raúl', 'Carmen', 'Óscar', 'Silvia', 'Hugo', 'Beatriz', 'Iván', 'Rocío', 'Marcos'];
const LAST = ['Serrano', 'Cabrera', 'Fuentes', 'Ibáñez', 'Navarro', 'Prieto', 'Salas', 'Varela', 'Aguirre', 'Bosque', 'Cordero', 'Delgado', 'Escudero', 'Ferrer', 'Garrido', 'Heredia', 'Iglesias', 'Juárez'];
const PRODUCTS: Array<{ prefix: string; product: string; risk: (i: number) => string; premium: number }> = [
  { prefix: 'AUTO', product: 'Auto', risk: (i) => `Seat León matrícula ${String(1000 + i).padStart(4, '0')}-SYN`, premium: 480 },
  { prefix: 'HOME', product: 'Hogar', risk: (i) => `Vivienda hogar Calle Sintética ${i} Madrid`, premium: 260 },
  { prefix: 'MOTO', product: 'Moto', risk: (i) => `Yamaha MT-07 matrícula ${String(2000 + i).padStart(4, '0')}-SYN`, premium: 295 },
  { prefix: 'COM', product: 'Comercio', risk: (i) => `Local comercial sintético número ${i}`, premium: 540 },
  { prefix: 'RC', product: 'RC Empresa', risk: (i) => `Actividad empresarial sintética ${i}`, premium: 900 },
];

function generateFiller(): { customers: CustomerRecord[]; policies: PolicyRecord[] } {
  const customers: CustomerRecord[] = [];
  const policies: PolicyRecord[] = [];
  for (let i = 0; i < 36; i++) {
    const id = `CUST-${String(i + 6).padStart(4, '0')}`;
    const name = `${FIRST[i % FIRST.length]} ${LAST[i % LAST.length]} ${LAST[(i + 7) % LAST.length]}`;
    customers.push({
      id,
      customerType: i % 9 === 0 ? 'COMPANY' : 'INDIVIDUAL',
      name,
      email: `synthetic.${i + 6}@example.test`,
      phone: `61${String(1000000 + i * 137).slice(0, 7)}`,
      taxIdFake: `0000${String(100 + i)}Z`,
    });
    // ~2 policies per filler customer to pass the 70-policy minimum.
    for (let p = 0; p < 2; p++) {
      const spec = PRODUCTS[(i + p) % PRODUCTS.length]!;
      const num = `${spec.prefix}-${String(100000 + i * 10 + p).slice(1)}`;
      policies.push({
        id: num,
        policyNumber: num,
        customerId: id,
        insurerId: SEED_INSURERS[(i + p) % SEED_INSURERS.length]!.id,
        product: spec.product,
        status: i % 11 === 0 ? 'CANCELLED' : i % 5 === 0 ? 'PENDING_RENEWAL' : 'ACTIVE',
        inceptionDate: `202${(i % 4) + 1}-0${(i % 9) + 1}-15`,
        renewalDate: `2026-${String((i % 12) + 1).padStart(2, '0')}-15`,
        premium: spec.premium + i,
        riskSummary: spec.risk(i),
      });
    }
  }
  return { customers, policies };
}

const filler = generateFiller();
export const SEED_CUSTOMERS: CustomerRecord[] = [...NAMED_CUSTOMERS, ...filler.customers];
export const SEED_POLICIES: PolicyRecord[] = [...NAMED_POLICIES, ...filler.policies];

export interface SeedUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'supervisor' | 'operator' | 'claims_specialist' | 'evaluator';
}

export const SEED_USERS: SeedUser[] = [
  { id: 'USER-ana', name: 'Ana Operadora (sintética)', email: 'ana@rosillo.test', role: 'operator' },
  { id: 'USER-carlos', name: 'Carlos Supervisor (sintético)', email: 'carlos@rosillo.test', role: 'supervisor' },
  { id: 'USER-admin', name: 'Alex Admin (sintético)', email: 'admin@rosillo.test', role: 'admin' },
  { id: 'USER-eva', name: 'Eva Evaluadora (sintética)', email: 'eva@rosillo.test', role: 'evaluator' },
  { id: 'USER-clara', name: 'Clara Siniestros (sintética)', email: 'clara@rosillo.test', role: 'claims_specialist' },
];
