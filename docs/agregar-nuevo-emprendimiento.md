# Guía: Agregar un Nuevo Emprendimiento a VendeFácil

## Resumen del sistema multi-tenant

VendeFácil es una plataforma SaaS multi-tenant donde cada emprendimiento (tenant) obtiene:
- Su propia tienda pública en `/{slug}/`
- Su propio panel admin en `/{slug}/admin/`
- Datos completamente aislados en MongoDB (productos, pedidos, recetas, etc.)
- Colores y logo personalizados

---

## Opción A — Creación directa desde SuperAdmin (recomendada para nuevos clientes)

### Paso 1: Reunir la información del cliente

Antes de crear el tenant necesitás tener listos:

| Campo | Descripción | Ejemplo |
|---|---|---|
| `slug` | Identificador único en la URL (sin espacios, minúsculas) | `mireposteria` |
| `name` | Nombre del negocio tal como aparecerá | `Mi Repostería Artesanal` |
| `email` | Email del dueño (será el usuario de login) | `dueño@gmail.com` |
| `whatsappNumber` | Número de WhatsApp con código de país | `50688887777` |
| `plan` | Plan contratado | `emprende`, `pro` o `premium` |
| `theme.primaryColor` | Color principal (hex) | `#FF6B9D` |
| `theme.secondaryColor` | Color secundario (hex) | `#FF8C42` |
| `theme.accentColor` | Color de acento (hex) | `#FFD166` |

> **Nota sobre el slug:** Debe ser único en toda la plataforma. Si el cliente quiere `dulcepecado` y ya existe, se debe usar una variación como `dulcepecado-sjo` o acordar otro nombre.

---

### Paso 2: Crear el tenant via API o SuperAdmin UI

#### Opción A1 — Via interfaz del SuperAdmin

1. Entrá a `/superadmin/login` con las credenciales de superadmin.
2. Ir a **Tenants → Crear nuevo**.
3. Llenar el formulario con los datos del cliente.
4. El sistema retorna una **contraseña temporal** — guardala para entregarla al cliente.

#### Opción A2 — Via API (para automatización o scripts)

```bash
curl -X POST https://tu-dominio.com/api/superadmin/tenants \
  -H "Content-Type: application/json" \
  -H "Cookie: superadmin_session=TU_TOKEN" \
  -d '{
    "slug": "mireposteria",
    "name": "Mi Repostería Artesanal",
    "email": "dueño@gmail.com",
    "whatsappNumber": "50688887777",
    "plan": "emprende",
    "status": "active",
    "theme": {
      "primaryColor": "#FF6B9D",
      "secondaryColor": "#FF8C42",
      "accentColor": "#FFD166"
    }
  }'
```

**Respuesta exitosa (`201 Created`):**
```json
{
  "tenant": { "_id": "...", "slug": "mireposteria", ... },
  "tempPassword": "xK9mPq1!"
}
```

---

### Paso 3: Entregar credenciales al cliente

Enviale al cliente:

```
¡Tu tienda ya está lista! 🎉

Panel de administración: https://vendefacilcr.com/mireposteria/admin/
Email: dueño@gmail.com
Contraseña temporal: xK9mPq1!

Por seguridad, cambiá tu contraseña después del primer ingreso.
```

---

### Paso 4: Configuración inicial (hecha por el cliente o vos)

Una vez dentro del admin, el cliente debe:

1. **Subir logo** → Configuración → Logo del negocio
2. **Personalizar "Acerca de"** → Configuración → Sección Acerca de
   - Título de sección
   - Dos párrafos descriptivos
   - Hasta 3 imágenes del negocio
3. **Configurar redes sociales** → Configuración → Redes Sociales
   - Instagram, Facebook, TikTok, YouTube
4. **Crear categorías de productos** → Configuración → Categorías
5. **Agregar productos** → Productos → Nuevo producto
   - Nombre, descripción, precio, imagen, categoría, disponibilidad

---

## Opción B — Flujo de solicitud (cliente aplica por su cuenta)

Este flujo es para cuando el cliente llena el formulario en la página principal de VendeFácil.

1. Cliente llena el formulario en `/` → Se crea un `TenantRequest` con status `"pending"`.
2. SuperAdmin ingresa a `/superadmin/solicitudes` y revisa las solicitudes pendientes.
3. SuperAdmin hace clic en **Aprobar** → El sistema automáticamente:
   - Crea el registro `Tenant` en MongoDB
   - Crea el usuario admin con contraseña temporal
   - Crea el primer registro de pago (`Payment`)
   - Actualiza el `TenantRequest` a status `"approved"`
4. SuperAdmin le envía la contraseña temporal al cliente.

---

## Qué crea el sistema automáticamente al aprobar

```
MongoDB
├── Tenant         → { slug, name, email, plan, status: "active", theme: colores por defecto }
├── User           → { email, password: hash(tempPassword), role: "admin", tenantId }
└── Payment        → { tenantId, plan, periodYear, periodMonth, amount, status: "pending" }
```

Todos los demás datos (productos, pedidos, materiales, recetas, gastos) los crea el cliente desde su panel.

---

## Verificación post-creación

Revisá que todo funcione:

- [ ] Tienda pública accesible: `/{slug}/`
- [ ] Login admin funciona: `/{slug}/admin/login`
- [ ] Admin puede ver su panel después de loguearse
- [ ] Los colores de la tienda reflejan el tema configurado
- [ ] El tenant aparece en `/superadmin/tenants`

---

## Precios de planes (referencia)

| Plan | Precio mensual (₡) |
|---|---|
| Emprende | ₡12,900 |
| Pro | ₡17,900 |
| Premium | ₡24,900 |

---

## Arquitectura técnica relevante

- **Modelo:** `src/models/Tenant.ts` — define el esquema del tenant
- **API creación:** `src/app/api/superadmin/tenants/route.ts` — POST crea tenant + usuario
- **API aprobación:** `src/app/api/superadmin/solicitudes/[id]/route.ts` — PATCH aprueba solicitud
- **Tienda pública:** `src/app/[tenant]/page.tsx` — renderiza la tienda con los colores del tenant
- **Panel admin:** `src/app/[tenant]/admin/` — todas las páginas del admin

---

---

# Mejoras propuestas: Personalización avanzada por cliente

## Problema actual

El sistema solo permite 3 colores (`primaryColor`, `secondaryColor`, `accentColor`) y una URL de logo. No hay control sobre:
- Fondo de la tienda
- Estilo del hero
- Imagen de fondo
- Color de fondo del logo
- Tipografía

Esto hace que todas las tiendas se vean estructuralmente iguales más allá de los colores.

---

## Mejora 1 — Fondo personalizable para la tienda

**Qué agregarías al modelo `Tenant.theme`:**

```typescript
theme: {
  // Existentes
  primaryColor:   string;  // "#FF6B9D"
  secondaryColor: string;  // "#FF8C42"
  accentColor:    string;  // "#FFD166"

  // Nuevos
  backgroundColor:  string;  // Color de fondo de la página, ej: "#FFF5F8" o "#FFFFFF"
  heroStyle:        "gradient" | "solid" | "image";  // Tipo de hero
  heroImageUrl:     string;  // URL de imagen de fondo del hero (si heroStyle = "image")
  cardBorderRadius: "none" | "sm" | "md" | "lg" | "xl";  // Redondez de tarjetas
}
```

**Impacto en `src/app/[tenant]/page.tsx`:** Se pasan las nuevas variables CSS al `div` raíz:
```tsx
style={{
  "--color-brand-pink":   primaryColor,
  "--color-bg":           backgroundColor ?? "#FFFFFF",
  "--card-radius":        cardBorderRadius ?? "12px",
  // ...
}}
```

**Impacto en admin:** Agregar controles de color y upload de imagen en la página de Configuración.

---

## Mejora 2 — Logo con fondo de color personalizado

**Problema:** Si el cliente sube un logo PNG transparente sobre un fondo blanco, puede verse mal. Si el fondo de su tienda es oscuro, el logo desaparece.

**Solución:** Agregar campo `logoBackgroundColor` y `logoShape`:

```typescript
theme: {
  // ...existentes...
  logoBackgroundColor: string;  // ej: "#FF6B9D" o "transparent"
  logoShape: "circle" | "square" | "rounded" | "none";  // Forma del contenedor del logo
  logoPadding: boolean;  // Si agregar padding alrededor del logo
}
```

**En el componente `Footer` y `HeroSection`**, el logo se renderizaría así:
```tsx
<div
  style={{
    backgroundColor: logoBackgroundColor,
    borderRadius: logoShape === "circle" ? "50%" : logoShape === "rounded" ? "12px" : "0",
    padding: logoPadding ? "8px" : "0",
  }}
>
  <img src={logoUrl} alt={tenantName} />
</div>
```

---

## Mejora 3 — Imagen de fondo para el Hero

**Problema actual:** El hero usa un gradiente de los 3 colores del tema. No hay forma de poner una imagen de fondo (foto del negocio, productos, etc.).

**Solución:**
- Agregar campo `heroImageUrl` en el tema
- El hero detecta si hay imagen y la usa como background con overlay del color primario
- El cliente sube la imagen desde Configuración vía Supabase Storage (ya existe el endpoint `/api/admin/upload`)

```tsx
// En HeroSection.tsx
{heroImageUrl ? (
  <div
    className="relative"
    style={{
      backgroundImage: `url(${heroImageUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    }}
  >
    {/* Overlay con el color primario al 70% de opacidad */}
    <div style={{ background: `${primaryColor}B3` }} className="absolute inset-0" />
    {/* Contenido del hero encima */}
    <div className="relative z-10">...</div>
  </div>
) : (
  <div style={{ background: gradientBrand }}>...</div>
)}
```

---

## Mejora 4 — Selección de tipografía

**Problema:** Todas las tiendas usan la misma fuente (la del layout raíz).

**Solución:** Permitir al cliente elegir entre un set de Google Fonts predefinidas.

```typescript
theme: {
  // ...
  fontFamily: "default" | "playfair" | "lato" | "montserrat" | "nunito" | "dancing";
}
```

En el storefront, el componente raíz aplicaría la fuente:
```tsx
<div style={{ fontFamily: FONT_MAP[fontFamily] ?? "inherit" }}>
```

Las fuentes se cargan dinámicamente solo cuando el tenant las necesita (evita cargar todas para todos).

---

## Mejora 5 — Modo oscuro por tenant

**Problema:** Algunas marcas tienen identidades visuales oscuras (cafeterías, chocolaterías, licorería artesanal).

**Solución:** Agregar campo `darkMode: boolean` en el tema. En la tienda pública se aplica la clase `dark` al root del tenant — el resto funciona con `dark:` de Tailwind.

```typescript
theme: {
  // ...
  darkMode: boolean;
}
```

---

## Priorización sugerida

| # | Mejora | Impacto | Complejidad |
|---|---|---|---|
| 1 | Fondo de tienda personalizable | Alto | Baja |
| 2 | Logo con fondo de color | Alto | Baja |
| 3 | Imagen de fondo en el Hero | Alto | Media |
| 4 | Tipografía personalizable | Medio | Media |
| 5 | Modo oscuro por tenant | Medio | Alta |

**Recomendación para empezar:** Las mejoras 1 y 2 son las más fáciles de implementar y tienen el mayor impacto visual para diferenciar a cada cliente. Solo requieren:
1. Agregar 2-3 campos al schema `Tenant` en MongoDB
2. Pasar esos valores como CSS variables en `page.tsx`
3. Agregar controles en la página de Configuración del admin

---

## Dónde tocar el código para implementar las mejoras

| Archivo | Qué cambiar |
|---|---|
| [src/models/Tenant.ts](../src/models/Tenant.ts) | Agregar campos nuevos al schema e interface `ITenantTheme` |
| [src/app/[tenant]/page.tsx](../src/app/%5Btenant%5D/page.tsx) | Pasar nuevas CSS variables al `div` raíz |
| [src/app/[tenant]/admin/configuracion/page.tsx](../src/app/%5Btenant%5D/admin/configuracion/page.tsx) | Agregar controles de UI para los nuevos campos |
| [src/app/api/admin/settings/route.ts](../src/app/api/admin/settings/route.ts) | Si el endpoint de settings guarda el tema, actualizar para aceptar los nuevos campos |
| `src/components/HeroSection.tsx` | Leer `heroImageUrl` y renderizar background dinámico |
| `src/components/Footer.tsx` | Leer `logoBackgroundColor` y `logoShape` |
