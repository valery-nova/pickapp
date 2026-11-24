import "server-only";
import { env } from "@/lib/env";
import type { DemoDb } from "@/lib/types";

const globalKey = "__pickappDemoDb";

type DemoGlobal = typeof globalThis & { [globalKey]?: DemoDb };

function now() {
  return new Date().toISOString();
}

function id() {
  return crypto.randomUUID();
}

function emptyDb(): DemoDb {
  return {
    profiles: [],
    businesses: [],
    products: [],
    productImages: [],
    productVariants: [],
    inventory: [],
    inventoryMovements: [],
    inventoryReservations: [],
    customers: [],
    orders: [],
    orderItems: [],
    liveSessions: [],
    liveComments: [],
    conversations: [],
    messages: [],
    salesInsights: [],
    automationLogs: [],
    notificationPreferences: [],
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function seedDemoDb(db: DemoDb) {
  const timestamp = now();
  const entrepreneurId = id();
  const businessId = id();
  const profile: DemoDb["profiles"][number] = {
    id: entrepreneurId,
    clerk_user_id: "demo-entrepreneur",
    email: "demo@pickapp.local",
    full_name: "Demo Emprendedora",
    role: "entrepreneur",
    created_at: timestamp,
  };
  const business: DemoDb["businesses"][number] = {
    id: businessId,
    owner_profile_id: entrepreneurId,
    name: "Casa Nova",
    slug: "casa-nova",
    description:
      "Tienda demo de PICKAPP con accesorios, ropa y productos seleccionados para mujeres emprendedoras.",
    category: "Moda y accesorios",
    logo_url: "/brand/pickapp-logo.jpeg",
    cover_url: "/brand/pickapp-logo.jpeg",
    contact_email: "hola@casanova.demo",
    contact_phone: "+591 70000000",
    status: "active",
    created_at: timestamp,
    updated_at: timestamp,
  };
  db.profiles.push(profile);
  db.businesses.push(business);

  const seedProducts = [
    {
      name: "Vestido Midi Floral",
      description:
        "Vestido midi con estampado floral, corte ligero y detalles en cintura. Ideal para looks de día o eventos.",
      category: "Ropa",
      tags: ["vestido", "floral", "midi", "mujer"],
      price: 189,
      stock: 8,
      featured: true,
    },
    {
      name: "Bolso Tejido Natural",
      description:
        "Bolso tejido a mano en fibra natural con cierre de botón. Perfecto para mercado, playa o paseo.",
      category: "Accesorios",
      tags: ["bolso", "tejido", "natural", "handmade"],
      price: 95,
      stock: 12,
      featured: true,
    },
    {
      name: "Labial Matte Cereza",
      description:
        "Labial mate de larga duración con acabado suave y color cereza versátil.",
      category: "Belleza",
      tags: ["labial", "mate", "beauty", "cereza"],
      price: 45,
      stock: 20,
      featured: false,
    },
    {
      name: "Tote Canvas Minimal",
      description:
        "Tote de canvas resistente con interior reforzado y tiras cortas ajustables.",
      category: "Accesorios",
      tags: ["tote", "canvas", "minimal", "trabajo"],
      price: 120,
      stock: 5,
      featured: false,
    },
  ];

  for (const item of seedProducts) {
    const productId = id();
    db.products.push({
      id: productId,
      business_id: businessId,
      name: item.name,
      slug: slugify(item.name),
      description: item.description,
      category: item.category,
      tags: item.tags,
      price: item.price,
      currency: "BOB",
      status: "published",
      featured: item.featured,
      ai_generated: false,
      created_at: timestamp,
      updated_at: timestamp,
    });
    db.productImages.push({
      id: id(),
      product_id: productId,
      storage_path: `/brand/product-placeholder.svg`,
      url: "/brand/product-placeholder.svg",
      alt: item.name,
      sort_order: 0,
      created_at: timestamp,
    });
    db.inventory.push({
      id: id(),
      business_id: businessId,
      product_id: productId,
      quantity: item.stock,
      reserved_quantity: 0,
      low_stock_threshold: 3,
      updated_at: timestamp,
    });
  }

  db.notificationPreferences.push({
    id: id(),
    business_id: businessId,
    channel: "app",
    enabled: true,
    config: { email: "hola@casanova.demo" },
    updated_at: timestamp,
  });

  const liveId = id();
  const liveProductIds = db.products.map((product) => product.id);
  db.liveSessions.push({
    id: liveId,
    business_id: businessId,
    title: "Nueva colección primavera",
    description: "Demo LIVE con productos destacados y comentarios en tiempo real.",
    status: "scheduled",
    featured_product_ids: liveProductIds,
    started_at: null,
    ended_at: null,
    created_at: timestamp,
  });

  db.automationLogs.push({
    id: id(),
    business_id: businessId,
    workflow: "inventory-automation",
    event: "demo_seed",
    status: "success",
    payload: { mode: "demo", seeded: true },
    created_at: timestamp,
  });
}

export function getDemoDb(): DemoDb {
  const global = globalThis as DemoGlobal;
  if (!global[globalKey]) {
    global[globalKey] = emptyDb();
    if (env.demoSeed) seedDemoDb(global[globalKey]);
  }
  return global[globalKey];
}

export function resetDemoDb() {
  const global = globalThis as DemoGlobal;
  global[globalKey] = emptyDb();
  if (env.demoSeed) seedDemoDb(global[globalKey]);
  return getDemoDb();
}
