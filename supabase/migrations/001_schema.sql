-- =============================================
-- SistemaControlStock — Schema inicial
-- =============================================

-- Clientes (antes cuentasCorrientes)
CREATE TABLE IF NOT EXISTS clientes (
  id            BIGINT PRIMARY KEY,
  nombre        TEXT NOT NULL,
  telefono      TEXT,
  dni           TEXT,
  direccion     TEXT,
  tipo_precio   TEXT DEFAULT 'publico',
  saldo         NUMERIC DEFAULT 0,
  ultimo_movimiento TEXT,
  historial_movimientos JSONB DEFAULT '[]',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Vehículos
CREATE TABLE IF NOT EXISTS vehiculos (
  id              BIGINT PRIMARY KEY,
  patente         TEXT NOT NULL,
  modelo          TEXT,
  cliente_id      BIGINT REFERENCES clientes(id) ON DELETE SET NULL,
  dueno           TEXT,
  telefono        TEXT,
  historial_duenos JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS vehiculos_patente_idx ON vehiculos(patente);

-- Services
CREATE TABLE IF NOT EXISTS services (
  id                  BIGINT PRIMARY KEY,
  vehiculo_id         BIGINT REFERENCES vehiculos(id) ON DELETE CASCADE,
  fecha               TEXT,
  kilometraje         TEXT,
  aceite              TEXT,
  filtro_aceite       TEXT,
  filtro_aire         TEXT,
  filtro_combustible  TEXT,
  filtro_habitaculo   TEXT,
  observaciones       TEXT,
  mano_de_obra        TEXT,
  proximo_service     TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Productos
CREATE TABLE IF NOT EXISTS productos (
  id              BIGINT PRIMARY KEY,
  codigo          TEXT,
  nombre          TEXT NOT NULL,
  stock           NUMERIC DEFAULT 0,
  precio_publico  NUMERIC DEFAULT 0,
  precio_mecanico NUMERIC DEFAULT 0,
  categoria       TEXT,
  proveedor       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Proveedores
CREATE TABLE IF NOT EXISTS proveedores (
  id      SERIAL PRIMARY KEY,
  nombre  TEXT NOT NULL UNIQUE
);

-- Categorías personalizadas
CREATE TABLE IF NOT EXISTS categorias_personalizadas (
  id      SERIAL PRIMARY KEY,
  nombre  TEXT NOT NULL UNIQUE
);

-- Caja (movimientos)
CREATE TABLE IF NOT EXISTS caja (
  id          BIGINT PRIMARY KEY,
  tipo        TEXT,
  descripcion TEXT,
  monto       NUMERIC DEFAULT 0,
  medio_pago  TEXT,
  fecha       TEXT,
  detalle     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Presupuestos
CREATE TABLE IF NOT EXISTS presupuestos (
  id               BIGINT PRIMARY KEY,
  numero           INTEGER,
  fecha            TEXT,
  cliente_id       BIGINT,
  cliente_nombre   TEXT,
  vehiculo_id      BIGINT,
  vehiculo_patente TEXT,
  vehiculo_modelo  TEXT,
  estado           TEXT DEFAULT 'pendiente',
  campos_service   JSONB DEFAULT '{}',
  cantidad_aceite  NUMERIC DEFAULT 1,
  otros_items      JSONB DEFAULT '[]',
  total            NUMERIC DEFAULT 0,
  observaciones    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Turnos (agenda)
CREATE TABLE IF NOT EXISTS turnos (
  id           BIGINT PRIMARY KEY,
  vehiculo_id  BIGINT,
  patente      TEXT,
  dueno        TEXT,
  modelo       TEXT,
  fecha        DATE,
  hora         TEXT,
  tipo_service TEXT,
  estado       TEXT DEFAULT 'pendiente',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Row Level Security (sin auth por ahora: acceso público)
-- =============================================
ALTER TABLE clientes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehiculos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE services                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores              ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_personalizadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE caja                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos                   ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas (acceso total con anon key — sin login por ahora)
CREATE POLICY "allow_all_clientes"                  ON clientes                  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_vehiculos"                 ON vehiculos                 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_services"                  ON services                  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_productos"                 ON productos                 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_proveedores"               ON proveedores               FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_categorias_personalizadas" ON categorias_personalizadas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_caja"                      ON caja                      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_presupuestos"              ON presupuestos              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_turnos"                    ON turnos                    FOR ALL USING (true) WITH CHECK (true);
