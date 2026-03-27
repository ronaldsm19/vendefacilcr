export interface SeedProduct {
  name: string;
  description: string;
  price: number;
  toppings: string[];
  image: string;
  images?: string[];
  featured?: boolean;
  delivery?: boolean;
  deliveryNote?: string;
  offers?: { qty: number; price: number }[];
  stock?: number;
  category: "gelatina" | "apretado" | "especial";
  available: boolean;
}

export const seedProducts: SeedProduct[] = [
  // ── Gelatinas Mosaico ──────────────────────────────────────────────
  {
    name: "Gelatina Mosaico Clásica",
    description:
      "Nuestra gelatina mosaico tradicional con una presentación colorida e irresistible. Elaborada con gelatinas de colores vivos cortadas en cubos perfectos, bañadas en una suave gelatina de leche cremosa. Perfecta para compartir en familia o como postre de celebración.",
    price: 3500,
    toppings: ["Maní caramelizado", "Chocolate rallado", "Coco tostado"],
    image:
      "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&q=80&fit=crop",
    category: "gelatina",
    available: true,
  },
  {
    name: "Gelatina Mosaico Premium",
    description:
      "La versión más lujosa de nuestra gelatina mosaico, con ingredientes premium seleccionados. Combina gelatinas artesanales con base de leche condensada y crema, decorada con los mejores toppings importados. Una experiencia sensorial única que enamora desde el primer bocado.",
    price: 4500,
    toppings: [
      "Maní caramelizado",
      "Chocolate belga rallado",
      "Coco tostado",
      "Fresas frescas",
    ],
    image:
      "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=600&q=80&fit=crop",
    category: "gelatina",
    available: true,
  },
  {
    name: "Gelatina Mosaico Tropical",
    description:
      "Un viaje a los sabores tropicales de Costa Rica en cada cucharada. Gelatinas de frutas naturales como mango, maracuyá y guayaba, armonizadas con una base cremosa de leche de coco. Una creación fresca y exótica inspirada en la biodiversidad costarricense.",
    price: 4000,
    toppings: [
      "Mango deshidratado",
      "Maracuyá fresco",
      "Coco tostado",
      "Granola artesanal",
    ],
    image:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80&fit=crop",
    category: "gelatina",
    available: true,
  },

  // ── Apretados Gourmet ──────────────────────────────────────────────
  {
    name: "Apretado Nutella Dream",
    description:
      "El sueño de todo amante del chocolate hecho realidad. Nuestro apretado artesanal relleno de cremosa Nutella, cubierto con una capa de avellanas caramelizadas y hilos de chocolate oscuro. Una indulgencia pura que te hará cerrar los ojos con cada mordisco.",
    price: 2800,
    toppings: ["Nutella", "Avellanas caramelizadas", "Hilos de chocolate oscuro"],
    image:
      "https://images.unsplash.com/photo-1560008581-09826d1de69e?w=600&q=80&fit=crop",
    category: "apretado",
    available: true,
  },
  {
    name: "Apretado Oreo Supreme",
    description:
      "La combinación perfecta entre lo crujiente y lo cremoso. Un apretado suave relleno de crema de vainilla casera, cubierto con una generosa capa de galletas Oreo molidas y trozos enteros. Un postre nostálgico elevado a nivel gourmet.",
    price: 2500,
    toppings: ["Oreo molido", "Oreo en trozos", "Crema de vainilla"],
    image:
      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&q=80&fit=crop",
    category: "apretado",
    available: true,
  },
  {
    name: "Apretado Fresas con Crema",
    description:
      "Frescura y elegancia en cada bocado. Apretado artesanal con relleno de fresas frescas de temporada y chantilly natural, decorado con coulis de fresa y fresas enteras glaseadas. Un clásico reinventado con productos locales de primera calidad.",
    price: 2800,
    toppings: [
      "Fresas frescas",
      "Crema chantilly",
      "Coulis de fresa",
      "Azúcar glass",
    ],
    image:
      "https://images.unsplash.com/photo-1488477304112-4944851de03d?w=600&q=80&fit=crop",
    category: "apretado",
    available: true,
  },
  {
    name: "Apretado Maracuyá Passion",
    description:
      "La intensidad del maracuyá costarricense en su máxima expresión. Apretado cremoso bañado en una salsa agridulce de pulpa natural de maracuyá con leche condensada, equilibrado con un toque de ralladura de limón. Un sabor que despierta todos los sentidos.",
    price: 2600,
    toppings: ["Pulpa de maracuyá", "Leche condensada", "Ralladura de limón"],
    image:
      "https://images.unsplash.com/photo-1571506165871-ee72a35bc9d4?w=600&q=80&fit=crop",
    category: "apretado",
    available: true,
  },
];
