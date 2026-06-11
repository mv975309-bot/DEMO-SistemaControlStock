-- Eliminar políticas existentes para poder recrearlas
DROP POLICY IF EXISTS "allow_all_clientes"                  ON clientes;
DROP POLICY IF EXISTS "allow_all_vehiculos"                 ON vehiculos;
DROP POLICY IF EXISTS "allow_all_services"                  ON services;
DROP POLICY IF EXISTS "allow_all_productos"                 ON productos;
DROP POLICY IF EXISTS "allow_all_proveedores"               ON proveedores;
DROP POLICY IF EXISTS "allow_all_categorias_personalizadas" ON categorias_personalizadas;
DROP POLICY IF EXISTS "allow_all_caja"                      ON caja;
DROP POLICY IF EXISTS "allow_all_presupuestos"              ON presupuestos;
DROP POLICY IF EXISTS "allow_all_turnos"                    ON turnos;

-- Recrear políticas permisivas (sin login por ahora)
CREATE POLICY "allow_all_clientes"                  ON clientes                  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_vehiculos"                 ON vehiculos                 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_services"                  ON services                  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_productos"                 ON productos                 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_proveedores"               ON proveedores               FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_categorias_personalizadas" ON categorias_personalizadas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_caja"                      ON caja                      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_presupuestos"              ON presupuestos              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_turnos"                    ON turnos                    FOR ALL USING (true) WITH CHECK (true);
