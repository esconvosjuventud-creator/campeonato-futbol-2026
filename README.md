# Campeonato de Fútbol 2026 — versión GitHub Pages + Supabase

Formulario público para la 14.ª Edición del Campeonato de Fútbol “Que en tu equipo no juegue la violencia”.

## Qué permite
- Inscripción por equipo, mínimo 5 y máximo 10 participantes.
- Categorías Masculino 13–15, Masculino 16–22 y Femenino Libre.
- Validación de edad al 11/09/2026.
- Carga real de cédula y carné de aptitud física.
- Autorización obligatoria para menores de 18 años.
- Permiso de imagen individual: Sí / No.
- Documentos en bucket privado.
- Panel administrativo con login, filtros, descarga privada, estados y exportación CSV.
- Cierre de inscripciones después del 11/09/2026.

## Arquitectura
- GitHub Pages: interfaz pública y panel administrativo.
- Supabase: PostgreSQL, Auth, Storage privado y funciones RPC.

La Publishable key de Supabase puede estar en el navegador. La protección se implementa mediante RLS, funciones `security definer` y un bucket privado. No colocar nunca una `service_role` key en GitHub ni en el navegador.

## Puesta en marcha

### 1. Crear proyecto en Supabase
Entrar a Supabase y crear un proyecto nuevo.

### 2. Crear base de datos y reglas
Abrir **SQL Editor**, pegar todo el contenido de `supabase/schema.sql` y ejecutarlo.

### 3. Configurar la web
En Supabase, copiar:
- Project URL
- Publishable key (o anon key, según el panel disponible)

Editar `js/config.js`:
```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://prkgpliedgdadokzprcy.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ZYOu7LJGk5fB61B2o4kgCA_kzxk1l7Q"
};
```

### 4. Crear el usuario administrador
En Supabase > **Authentication > Users**, crear el usuario que usará el panel administrativo.
Copiar su UUID y ejecutar en SQL Editor:
```sql
insert into public.admin_users(user_id, display_name)
values ('UUID_DEL_USUARIO', 'Organización');
```

### 5. Subir a GitHub
Crear un repositorio, subir todos los archivos de este paquete y asegurarse de que la rama principal se llame `main`.

### 6. Activar GitHub Pages
En el repositorio:
**Settings > Pages > Build and deployment > Source > GitHub Actions**.

El archivo `.github/workflows/pages.yml` publicará automáticamente el sitio en cada push a `main`.

La dirección normal será:
`https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/`

Panel administrativo:
`https://TU-USUARIO.github.io/NOMBRE-DEL-REPOSITORIO/admin.html`

## Seguridad importante
Este sitio recopila cédulas y datos de menores. Antes de abrir las inscripciones:
- verificar jurídicamente el texto de protección de datos y autorizaciones;
- usar únicamente el bucket privado incluido;
- no compartir cuentas administrativas;
- activar MFA para las cuentas administrativas si está disponible;
- definir cuándo se eliminarán los documentos luego del campeonato;
- comprobar las políticas RLS después de cualquier modificación en Supabase.

## Prueba previa recomendada
1. Hacer una inscripción ficticia de 5 participantes.
2. Comprobar que aparece el número `CF2026-001`.
3. Ingresar a `admin.html`.
4. Abrir los documentos mediante URLs temporales.
5. Cambiar el estado del equipo y de un participante.
6. Exportar CSV.
7. Probar desde Android y iPhone.
