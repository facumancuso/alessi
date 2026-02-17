
'use server';

import { createService, createProduct } from './data';
import type { User, Product } from './types';

const defaultUsers: Omit<User, 'id'>[] = [
    { name: 'Admin', email: 'admin@alessi.com', password: 'okalessi', role: 'Superadmin', isActive: true },
    { name: 'Matias', email: 'gerente@alessi.com', password: 'Matias22', role: 'Gerente', isActive: true },
    { name: 'Sabrina', email: 'recepcion@alessi.com', password: 'Sabrina1', role: 'Recepcion', isActive: true },
    { name: 'Miguel Alessi', email: 'miguel.alessi@alessi.com', password: 'Miguelok', role: 'Peluquero', isActive: true },
    { name: 'Viviana', email: 'viviana@alessi.com', password: 'alessiok', role: 'Peluquero', isActive: true },
    { name: 'Ines', email: 'ines@alessi.com', password: 'alessiok', role: 'Peluquero', isActive: true },
    { name: 'Yamila', email: 'yamila@alessi.com', password: 'alessiok', role: 'Peluquero', isActive: true },
    { name: 'Noelia', email: 'noelia@alessi.com', password: 'alessiok', role: 'Peluquero', isActive: true },
    { name: 'Gonzalo', email: 'gonzalo@alessi.com', password: 'alessiok', role: 'Peluquero', isActive: true },
    { name: 'Federico', email: 'federico@alessi.com', password: 'alessiok', role: 'Peluquero', isActive: true },
];

const defaultServices = [
    { code: '40', name: 'COLORFULHAIR LARGO', duration: 30, price: 0 },
    { code: '39', name: 'COLORFULHAIR PARCIAL', duration: 30, price: 0 },
    { code: '76', name: 'ADICIONAL TINTURA', duration: 30, price: 0 },
    { code: '22', name: 'ADICIONAL TUBO INOA', duration: 30, price: 0 },
    { code: '469', name: 'ALISADO GLOBAL', duration: 30, price: 0 },
    { code: '470', name: 'ALISADO GLOBAL EXTRA LARGO', duration: 30, price: 0 },
    { code: '281', name: 'ALISADO PARCIAL PERIMETROS', duration: 30, price: 0 },
    { code: '282', name: 'ALISADO PARCIAL SUPERFICIE', duration: 30, price: 0 },
    { code: '31', name: 'BABY LIGHT PARCIALES', duration: 30, price: 0 },
    { code: '32', name: 'BABYLIGHT GLOBALES', duration: 30, price: 0 },
    { code: '279', name: 'BALAYAGE', duration: 30, price: 0 },
    { code: '34', name: 'BALAYAGE CORTO', duration: 30, price: 0 },
    { code: '35', name: 'BALAYAGE MEDIANO', duration: 30, price: 0 },
    { code: '33', name: 'BRONDE', duration: 30, price: 0 },
    { code: '3', name: 'BRUSHING MIGUEL ANGEL', duration: 30, price: 0 },
    { code: '4', name: 'BRUSHING STAFF', duration: 30, price: 0 },
    { code: '390', name: 'COLOR 10', duration: 30, price: 0 },
    { code: '441', name: 'COLOR CORRECCION', duration: 30, price: 0 },
    { code: '14', name: 'COLOR EXPRESS CORTO SILKEY', duration: 30, price: 0 },
    { code: '16', name: 'COLOR EXPRESS LARGO SILKEY', duration: 30, price: 0 },
    { code: '15', name: 'COLOR EXPRESS MEDIANO SILKEY', duration: 30, price: 0 },
    { code: '452', name: 'COLOR HOMBRE GLOBAL', duration: 30, price: 0 },
    { code: '453', name: 'COLOR HOMBRE PARCIAL', duration: 30, price: 0 },
    { code: '288', name: 'COLOR KEY', duration: 30, price: 0 },
    { code: '1', name: 'CORTE MIGUEL', duration: 30, price: 0 },
    { code: '461', name: 'Corte Puntas', duration: 30, price: 0 },
    { code: '440', name: 'Corte Yamila', duration: 30, price: 0 },
    { code: '37', name: 'COUNTURING LARGO', duration: 30, price: 0 },
    { code: '36', name: 'COUNTURING MEDIANO', duration: 30, price: 0 },
    { code: '102', name: 'CURL CONTOUR', duration: 30, price: 0 },
    { code: '24', name: 'DECAPAGE LARGO', duration: 30, price: 0 },
    { code: '23', name: 'DECAPAGE MEDIANO', duration: 30, price: 0 },
    { code: '468', name: 'DECAPAGE RAIZ', duration: 30, price: 0 },
    { code: '28', name: 'DESVOLUMINIZADO', duration: 30, price: 0 },
    { code: '396', name: 'DIA COLOR', duration: 30, price: 0 },
    { code: '395', name: 'DIA LIGHT', duration: 30, price: 0 },
    { code: '286', name: 'DIA RICHESSE', duration: 30, price: 0 },
    { code: '467', name: 'DISEÑO HAND UP', duration: 30, price: 0 },
    { code: '30', name: 'HIGHLIGHT GLOBALES', duration: 30, price: 0 },
    { code: '29', name: 'HIGHLIGHT PARCIALES', duration: 30, price: 0 },
    { code: '455', name: 'HIGHLIGHTS PLUS', duration: 30, price: 0 },
    { code: '38', name: 'ICE/GREY COLOR CORTO', duration: 30, price: 0 },
    { code: '19', name: 'INOA CORTO', duration: 30, price: 0 },
    { code: '21', name: 'INOA LARGO', duration: 30, price: 0 },
    { code: '20', name: 'INOA MEDIANO', duration: 30, price: 0 },
    { code: '43', name: 'LAVADO EXPRESS', duration: 30, price: 0 },
    { code: '458', name: 'LAVADO TRATANTE LOREAL', duration: 30, price: 0 },
    { code: '297', name: 'METAL DETOX', duration: 30, price: 0 },
    { code: '466', name: 'Ninfas', duration: 30, price: 0 },
    { code: '27', name: 'ONDULACION PERMANENTE EX LARGO', duration: 30, price: 0 },
    { code: '26', name: 'ONDULACION PERMANENTE LARGO', duration: 30, price: 0 },
    { code: '25', name: 'ONDULACION PERMANENTE MEDIANO', duration: 30, price: 0 },
    { code: '278', name: 'OSIS MESS UP', duration: 30, price: 0 },
    { code: '460', name: 'Otro', duration: 30, price: 0 },
    { code: '13', name: 'PEINADO 15 AÑOS MIGUEL ANGEL', duration: 30, price: 0 },
    { code: '12', name: 'PEINADO 15 STAFF', duration: 30, price: 0 },
    { code: '280', name: 'PEINADO DIRECTOR', duration: 30, price: 0 },
    { code: '11', name: 'PEINADO NOVIA MIGUEL ANGEL', duration: 30, price: 0 },
    { code: '10', name: 'PEINADO NOVIA STAFF', duration: 30, price: 0 },
    { code: '8', name: 'PIERCING HAIR', duration: 30, price: 0 },
    { code: '9', name: 'POSTIZO (alquiler)', duration: 30, price: 0 },
    { code: '7', name: 'RECOGIDO STAFF', duration: 30, price: 0 },
    { code: '6', name: 'RECOGIGO MIGUEL ANGEL', duration: 30, price: 0 },
    { code: '450', name: 'RIT ABSOLUT MOLECULAR', duration: 30, price: 0 },
    { code: '446', name: 'RIT HAIRSSIME (MASC+AMPOLLA)', duration: 30, price: 0 },
    { code: '447', name: 'RIT HAIRSSIME (MASCARA)', duration: 30, price: 0 },
    { code: '454', name: 'RIT K18', duration: 30, price: 0 },
    { code: '443', name: 'RIT SCHWARZKOPF', duration: 30, price: 0 },
    { code: '445', name: 'RIT ULTRALIV', duration: 30, price: 0 },
    { code: '463', name: 'Ritual Absolut Molecular', duration: 30, price: 0 },
    { code: '465', name: 'RITUAL HAIRSSIME', duration: 30, price: 0 },
    { code: '472', name: 'RITUAL KERASTASE', duration: 30, price: 0 },
    { code: '47', name: 'RITUAL LOREAL', duration: 30, price: 0 },
    { code: '49', name: 'RITUAL MOROCCANOIL', duration: 30, price: 0 },
    { code: '41', name: 'ROOT SHADOW', duration: 30, price: 0 },
    { code: '5', name: 'SEMIRECOGIDO', duration: 30, price: 0 },
    { code: '459', name: 'SEÑA', duration: 30, price: 0 },
    { code: '42', name: 'SMARTBOND', duration: 30, price: 0 },
    { code: '128', name: 'STIFF POMMADE', duration: 30, price: 0 },
    { code: '169', name: 'SUPER DUST', duration: 30, price: 0 },
    { code: '170', name: 'THRILL', duration: 30, price: 0 },
    { code: '457', name: 'TONO SOBRE TONO CORTO', duration: 30, price: 0 },
    { code: '18', name: 'TONO SOBRE TONO LARGO', duration: 30, price: 0 },
    { code: '17', name: 'TONO SOBRE TONO MEDIANO', duration: 30, price: 0 },
    { code: '44', name: 'TRATAMIENTO LOREAL', duration: 30, price: 0 },
    { code: '45', name: 'TRATAMIENTO MOROCCANOIL', duration: 30, price: 0 },
    { code: '371', name: 'ULTRALIV', duration: 30, price: 0 },
    { code: '101', name: 'VARIOS', duration: 30, price: 0 },
    { code: '109', name: 'WEB PATE', duration: 30, price: 0 }
];

const defaultProducts: Omit<Product, 'id'>[] = [
    { code: '161', name: '10 EN 1 ABSOLUT', price: 0 },
    { code: '162', name: '10 EN 1 CHIQUITOS', price: 0 },
    { code: '158', name: '10 EN 1 VITAMINO', price: 0 },
    { code: '134', name: 'ACEITE MOROCCANOIL 100 ML', price: 0 },
    { code: '132', name: 'ACOND EXTRA VOLUMEN MOROCCANOIL', price: 0 },
    { code: '133', name: 'ACOND HIDRATANTE MOROCCANOIL', price: 0 },
    { code: '331', name: 'ACONDICIONADOR BIFASICO (FLUIDO) 240 ML - COLOR PROTEC', price: 0 },
    { code: '177', name: 'ACONDICIONADOR BLONDIFER', price: 0 },
    { code: '328', name: 'ACONDICIONADOR COLOR PROTEC 1480 ML - COLOR PROTEC', price: 0 },
    { code: '327', name: 'ACONDICIONADOR COLOR PROTEC 225 ML - COLOR PROTEC', price: 0 },
    { code: '414', name: 'ACONDICIONADOR CURLY', price: 0 },
    { code: '363', name: 'ACONDICIONADOR HYDRA VITAL 1480 ML - HYDRA VITAL', price: 0 },
    { code: '362', name: 'ACONDICIONADOR HYDRA VITAL 225 ML - HYDRA VITAL', price: 0 },
    { code: '405', name: 'ACONDICIONADOR MOROCABNOIL COLOR', price: 0 },
    { code: '336', name: 'ACONDICIONADOR NUTRI ADVANCE 1480 ML - NUTRI ADVANCE', price: 0 },
    { code: '335', name: 'ACONDICIONADOR NUTRI ADVANCE 225 ML - NUTRI ADVANCE', price: 0 },
    { code: '354', name: 'ACONDICIONADOR REPAIR FORCE 1480 ML - REPAIR FORCE', price: 0 },
    { code: '353', name: 'ACONDICIONADOR REPAIR FORCE 225 ML - REPAIR FORCE', price: 0 },
    { code: '148', name: 'ACONDICIONADOR REPARADOR REPAIR', price: 0 },
    { code: '341', name: 'CO-WASH CURLY MOTION 250 G - CURLY MOTION', price: 0 },
    { code: '344', name: 'CREMA ACTIVADORA CURLY MOTION 175 ML - CURLY MOTION', price: 0 },
    { code: '140', name: 'CREMA HIDRATANTE MOROCCANOIL', price: 0 },
    { code: '141', name: 'CREMA INTENSA PARA RIZOS CURL RULOS MOROCCANOIL', price: 0 },
    { code: '160', name: 'CREMA MOLDEADORA DE RIZOS MOROCCANOIL', price: 0 },
    { code: '234', name: 'CREME DE JOUR FONDAMENTALE 150 ML - CURL MANIFESTO', price: 0 },
    { code: '179', name: 'DIFUSOR', price: 0 },
    { code: '383', name: 'FUNDAS ALMOHADAS', price: 0 },
    { code: '451', name: 'GIFT CARD', price: 0 },
    { code: '364', name: 'HAIR OIL LOTION HYDRA VITAL 125 ML - HYDRA VITAL', price: 0 },
    { code: '368', name: 'IDEAL CURL 225 G', price: 0 },
    { code: '424', name: 'INFINIUM STRONG', price: 0 },
    { code: '105', name: 'MASCARA ABSOLUT', price: 0 },
    { code: '415', name: 'MASCARA ABSOLUT MOLECULAR', price: 0 },
    { code: '176', name: 'MASCARA BLONDIFIER', price: 0 },
    { code: '163', name: 'MASCARA CHIQUITA', price: 0 },
    { code: '329', name: 'MASCARA COLOR PROTEC 300 G - COLOR PROTEC', price: 0 },
    { code: '342', name: 'MASCARA CURLY MOTION 300 G - CURLY MOTION', price: 0 },
    { code: '138', name: 'MASCARA HIDRATANTE INTENSA MOROCCANOIL', price: 0 },
    { code: '337', name: 'MASCARA NUTRI ADVANCE 300 G - NUTRI ADVANCE', price: 0 },
    { code: '355', name: 'MASCARA REPAIR FORCE 300 G - REPAIR FORCE', price: 0 },
    { code: '139', name: 'MASCARA RESCONTRITUYENTE MOROCCANOIL', price: 0 },
    { code: '350', name: 'MASCARA SHADE CORRECT 300 ML - SHADE CORRECT', price: 0 },
    { code: '347', name: 'MASCARA SHADE CORRECT 300G - SHADE CORRECT', price: 0 },
    { code: '166', name: 'MASCARA SMOTH MOROCANNOIL', price: 0 },
    { code: '106', name: 'MASCARA VITAMINO', price: 0 },
    { code: '357', name: 'NUTRIKERATINA 120 ML - REPAIR FORCE', price: 0 },
    { code: '358', name: 'NUTRIKERATINA 225 ML - REPAIR FORCE', price: 0 },
    { code: '367', name: 'OIL LOTTION HYDRA VITAL 125 ML - HYDRA VITAL', price: 0 },
    { code: '180', name: 'PERFUMANTE TEXTIL', price: 0 },
    { code: '107', name: 'SERUM ABSOLUT', price: 0 },
    { code: '137', name: 'SH EXTRA VOLUMEN MOROCCANOIL', price: 0 },
    { code: '136', name: 'SH HIDRATANTE MOROCCANOIL', price: 0 },
    { code: '104', name: 'SH. ABSOLUT', price: 0 },
    { code: '149', name: 'SH. REPAIR REPARADOR', price: 0 },
    { code: '103', name: 'SH. VITAMINO', price: 0 },
    { code: '416', name: 'SHAMPOO ABSOLUT 500 ML SACHET', price: 0 },
    { code: '325', name: 'SHAMPOO COLOR PROTEC 350ML - COLOR PROTEC', price: 0 },
    { code: '340', name: 'SHAMPOO CURLY MOTION 350ML - CURLY MOTION', price: 0 },
    { code: '365', name: 'SHAMPOO EQUALIZER 350 ML - EQUALIZER', price: 0 },
    { code: '311', name: 'SHAMPOO GRASO', price: 0 },
    { code: '360', name: 'SHAMPOO HYDRA VITAL 350 ML - HYDRA VITAL', price: 0 },
    { code: '418', name: 'SHAMPOO METALK DETOX 500 ML SACHET', price: 0 },
    { code: '333', name: 'SHAMPOO NUTRI ADVANCE 350ML - NUTRI ADVANCE', price: 0 },
    { code: '351', name: 'SHAMPOO REPAIR FORCE 350 ML - REPAIR FORCE', price: 0 },
    { code: '349', name: 'SHAMPOO SHADE CORRECT PURPER 350 ML - SHADE CORRECT', price: 0 },
    { code: '345', name: 'SHAMPOO SHADE CORRECT SILVER 350ML - SHADE CORRECT', price: 0 },
    { code: '164', name: 'SHAMPOO SUAVISANTE MOROCCANOIL', price: 0 },
    { code: '417', name: 'SHAMPOO VITA', price: 0 },
    { code: '382', name: 'TRAVEL KIT', price: 0 },
    { code: '178', name: 'VELA', price: 0 }
];




export async function seedDatabase() {
  let createdServices = 0;
  let createdProducts = 0;
  let errors = 0;

  console.log('Starting database seeding for services and products...');

  // Seed Services
  for (const service of defaultServices) {
      try {
          await createService(service);
          createdServices++;
          console.log(`Created service: ${service.name}`);
      } catch(error) {
          console.error(`Failed to create service ${service.name}:`, error);
          errors++;
      }
  }

  // Seed Products
  for (const product of defaultProducts) {
      try {
          await createProduct(product);
          createdProducts++;
          console.log(`Created product: ${product.name}`);
      } catch(error) {
          console.error(`Failed to create product ${product.name}:`, error);
          errors++;
      }
  }


  const message = `Seeding complete. ${createdServices} services and ${createdProducts} products created. ${errors} errors occurred.`;
  console.log(message);
  return { success: true, message };
}
