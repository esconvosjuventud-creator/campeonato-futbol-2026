# GUÍA DETALLADA PARA PUBLICAR EL FORMULARIO EN GITHUB PAGES

## Campeonato de Fútbol 2026
### “Que en tu equipo no juegue la violencia”

Esta guía explica, paso por paso y desde cero, cómo dejar funcionando el formulario público de inscripción en **GitHub Pages**, utilizando **Supabase** para guardar las inscripciones, los datos personales y la documentación cargada.

La estructura del proyecto ya está preparada. No es necesario programar el sistema nuevamente.

---

# 1. QUÉ VAS A LOGRAR AL TERMINAR

Al finalizar esta guía vas a tener:

- Un enlace público para compartir con los participantes, por ejemplo:

  `https://TU-USUARIO.github.io/campeonato-futbol-2026/`

- Un panel administrativo privado:

  `https://TU-USUARIO.github.io/campeonato-futbol-2026/admin.html`

- Una base de datos en Supabase.
- Un espacio privado para guardar:
  - cédulas de identidad;
  - carnés de aptitud física.
- Un usuario administrador para ingresar al panel.
- Inscripciones numeradas automáticamente:
  - `CF2026-001`
  - `CF2026-002`
  - `CF2026-003`
  - etc.

---

# 2. CÓMO FUNCIONA EL SISTEMA

El proyecto utiliza dos servicios:

## GitHub Pages

GitHub Pages publica la parte visual del formulario:

- `index.html`
- `admin.html`
- CSS
- JavaScript
- imágenes

GitHub Pages **no guarda las inscripciones ni los documentos**.

## Supabase

Supabase se encarga de:

- base de datos;
- participantes;
- equipos;
- permisos;
- usuarios administradores;
- almacenamiento privado de documentos;
- autenticación del panel administrativo.

Por eso es necesario configurar **GitHub + Supabase**.

---

# 3. ARCHIVOS QUE DEBE TENER EL PROYECTO

Antes de comenzar, descomprimí el archivo ZIP del proyecto.

La carpeta debe contener esta estructura:

```text
.github/
  workflows/
    pages.yml

assets/
  placa-campeonato.jpeg

css/
  styles.css

js/
  admin.js
  app.js
  config.js

supabase/
  schema.sql

.gitignore
.nojekyll
admin.html
index.html
README.md
PUBLICAR-EN-GITHUB.md
```

## MUY IMPORTANTE

La carpeta:

```text
.github
```

debe subirse a GitHub.

Dentro se encuentra:

```text
.github/workflows/pages.yml
```

Ese archivo es el que permite publicar automáticamente el sitio mediante GitHub Actions.

---

# 4. QUÉ NECESITÁS

Antes de comenzar necesitás:

1. Una cuenta de GitHub.
2. Una cuenta de Supabase.
3. El ZIP del proyecto descomprimido.
4. Un correo electrónico para el usuario administrador.
5. Acceso a un navegador web.

No es necesario instalar Node.js, Visual Studio Code ni ningún servidor local para la publicación básica.

---

# PARTE A — CONFIGURAR SUPABASE

# 5. CREAR UNA CUENTA EN SUPABASE

Ingresá a:

https://supabase.com/

Elegí:

**Start your project**

o la opción equivalente para iniciar sesión.

Podés registrarte utilizando una cuenta compatible con las opciones que muestre Supabase.

Una vez dentro vas a llegar al Dashboard de Supabase.

---

# 6. CREAR EL PROYECTO DE SUPABASE

En el Dashboard:

1. Elegí **New project**.
2. Seleccioná tu organización.
3. En nombre del proyecto podés escribir:

```text
campeonato-futbol-2026
```

4. Creá una contraseña segura para la base de datos.

Ejemplo de nombre:

```text
campeonato-futbol-flores-2026
```

## IMPORTANTE SOBRE LA CONTRASEÑA

La contraseña de base de datos NO debe:

- colocarse en `config.js`;
- subirse a GitHub;
- compartirse públicamente.

Guardala en un lugar seguro.

5. Elegí una región razonablemente cercana a Uruguay si Supabase te permite seleccionarla.
6. Creá el proyecto.

Cuando el proyecto ya aparezca disponible en el Dashboard, continuá con el siguiente paso.

---

# 7. CREAR LA BASE DE DATOS DEL FORMULARIO

En la computadora, dentro de la carpeta del proyecto, buscá:

```text
supabase/schema.sql
```

Podés abrirlo con:

- Bloc de notas;
- Notepad++;
- Visual Studio Code;
- cualquier editor de texto.

No hay que modificar el archivo.

---

# 8. ABRIR SQL EDITOR EN SUPABASE

Dentro de tu proyecto Supabase:

1. Buscá en el menú lateral:

   **SQL Editor**

2. Elegí:

   **New query**

3. Volvé al archivo:

```text
supabase/schema.sql
```

4. Seleccioná TODO su contenido.
5. Copialo.
6. Pegalo en SQL Editor.

---

# 9. EJECUTAR EL SQL

Una vez pegado todo el contenido del archivo:

1. Comprobá que comienza aproximadamente con:

```sql
create extension if not exists pgcrypto;
```

2. Presioná:

**Run**

El script crea automáticamente:

- tabla `teams`;
- tabla `participants`;
- tabla `documents`;
- tabla `admin_users`;
- funciones de inscripción;
- validaciones;
- numeración;
- seguridad RLS;
- bucket privado `documentos`;
- reglas de subida;
- permisos administrativos.

## IMPORTANTE

Ejecutá el archivo **completo**, no por fragmentos.

---

# 10. COMPROBAR QUE EL SQL FUNCIONÓ

Después de ejecutarlo, revisá el resultado.

No debería aparecer un error rojo que indique que el proceso se interrumpió.

Podés comprobar la creación de las tablas ingresando en:

**Table Editor**

Deberían aparecer, entre otras:

```text
teams
participants
documents
admin_users
```

---

# 11. COMPROBAR STORAGE

Ingresá a:

**Storage**

Debería existir un bucket llamado:

```text
documentos
```

Debe ser **privado**.

No lo conviertas en público.

El formulario utilizará este bucket para almacenar:

- cédulas;
- carnés de aptitud física.

---

# 12. POR QUÉ EL BUCKET DEBE SER PRIVADO

Los archivos contienen documentación personal.

El proyecto está preparado para que:

- los participantes puedan subir sus documentos;
- los documentos no tengan una URL pública permanente;
- solamente los administradores autorizados puedan abrirlos desde el panel.

No cambies el bucket `documentos` a público.

---

# 13. OBTENER LA URL DEL PROYECTO Y LA PUBLISHABLE KEY

Ahora necesitamos conectar la página web con Supabase.

Supabase utiliza dos datos públicos para el navegador:

1. Project URL
2. Publishable key

La ubicación exacta puede variar ligeramente según la versión del Dashboard.

Buscá:

**Project Settings → API Keys**

o utilizá la opción:

**Connect**

Necesitás copiar:

### Project URL

Tiene una apariencia similar a:

```text
https://abcdefghijklmnop.supabase.co
```

### Publishable key

Actualmente las claves nuevas suelen comenzar con:

```text
sb_publishable_
```

También algunos proyectos pueden mostrar la clave pública heredada denominada `anon`.

Para este proyecto debe utilizarse una clave **pública / publishable**.

---

# 14. NO USAR SECRET KEY NI SERVICE_ROLE

Nunca pongas en GitHub una clave:

```text
sb_secret_...
```

ni:

```text
service_role
```

Tampoco deben colocarse en:

```text
js/config.js
```

Esas claves tienen permisos elevados y no son apropiadas para una página pública.

La que necesitamos es:

```text
Publishable key
```

---

# 15. CONFIGURAR `js/config.js`

Dentro de la carpeta del proyecto abrí:

```text
js/config.js
```

Originalmente vas a encontrar algo similar a:

```javascript
window.APP_CONFIG = {
  SUPABASE_URL: "PEGAR_AQUI_PROJECT_URL",
  SUPABASE_PUBLISHABLE_KEY: "PEGAR_AQUI_PUBLISHABLE_KEY"
};
```

Reemplazá solamente esos dos valores.

Ejemplo ficticio:

```javascript
window.APP_CONFIG = {
  SUPABASE_URL: "https://abcdefghijk.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_EJEMPLO123456"
};
```

Guardá el archivo.

## IMPORTANTE

No borres:

```javascript
window.APP_CONFIG = {
```

ni las llaves, comas o nombres de variables.

Solamente reemplazá lo que está entre comillas.

---

# PARTE B — CREAR EL ADMINISTRADOR

# 16. PARA QUÉ SIRVE EL USUARIO ADMINISTRADOR

El formulario público no necesita usuario ni contraseña.

Pero el panel:

```text
admin.html
```

sí requiere inicio de sesión.

El administrador puede:

- visualizar equipos;
- buscar participantes;
- consultar cédulas;
- consultar carnés;
- cambiar estados;
- agregar observaciones;
- exportar información.

---

# 17. CREAR EL USUARIO EN SUPABASE AUTHENTICATION

En Supabase ingresá a:

**Authentication → Users**

Buscá la opción:

**Add user**

Supabase puede ofrecer opciones como:

- crear usuario;
- enviar invitación.

Una forma conveniente es enviar una invitación al correo del administrador.

Ingresá el correo que utilizará la organización.

Ejemplo:

```text
juventud@ejemplo.uy
```

El administrador deberá completar el proceso para disponer de una contraseña.

---

# 18. OBTENER EL UUID DEL USUARIO

Una vez creado el usuario:

1. Entrá a:

   **Authentication → Users**

2. Abrí el usuario.
3. Buscá su identificador:

```text
User UID
```

o:

```text
UUID
```

Será similar a:

```text
8f73d17a-7ce5-4fb5-a903-cf70a87e49e7
```

Copialo completo.

---

# 19. DAR PERMISOS ADMINISTRATIVOS

Crear el usuario en Authentication no alcanza.

También hay que indicarle al sistema que ese usuario pertenece a la organización.

Volvé a:

**SQL Editor**

Elegí:

**New query**

Pegá:

```sql
insert into public.admin_users(user_id, display_name)
values ('UUID_DEL_USUARIO', 'Organización');
```

Reemplazá:

```text
UUID_DEL_USUARIO
```

por el UUID real.

Ejemplo ficticio:

```sql
insert into public.admin_users(user_id, display_name)
values ('8f73d17a-7ce5-4fb5-a903-cf70a87e49e7', 'Oficina de la Juventud');
```

Presioná:

**Run**

---

# 20. COMPROBAR EL ADMINISTRADOR

Ingresá en:

**Table Editor → admin_users**

Deberías ver una fila con:

- `user_id`;
- `display_name`.

Si está, el administrador quedó habilitado.

---

# 21. AGREGAR MÁS ADMINISTRADORES

Podés crear varios usuarios.

Por cada persona:

1. crear usuario en Authentication;
2. copiar UUID;
3. ejecutar:

```sql
insert into public.admin_users(user_id, display_name)
values ('UUID', 'NOMBRE');
```

Ejemplo:

```sql
insert into public.admin_users(user_id, display_name)
values ('11111111-2222-3333-4444-555555555555', 'Cruz Roja Flores');
```

Cada administrador debe tener su propia cuenta.

No es recomendable compartir una misma contraseña entre varias personas.

---

# PARTE C — PUBLICAR EN GITHUB

# 22. CREAR UNA CUENTA EN GITHUB

Si todavía no tenés una cuenta:

Ingresá a:

https://github.com/

Creá la cuenta y verificá el correo electrónico si GitHub lo solicita.

Después iniciá sesión.

---

# 23. CREAR UN REPOSITORIO NUEVO

En GitHub:

1. En la esquina superior derecha presioná el símbolo:

   **+**

2. Elegí:

   **New repository**

3. En:

   **Repository name**

escribí por ejemplo:

```text
campeonato-futbol-2026
```

La URL pública terminará utilizando este nombre.

Ejemplo:

```text
https://usuario.github.io/campeonato-futbol-2026/
```

---

# 24. ELEGIR VISIBILIDAD DEL REPOSITORIO

Para una cuenta gratuita y una publicación sencilla podés utilizar:

**Public**

El código del formulario será visible públicamente.

Esto es normal para un sitio publicado con GitHub Pages.

Los documentos de los participantes **NO se guardan en GitHub**.

Se guardan en el bucket privado de Supabase.

---

# 25. NO AGREGAR ARCHIVOS INICIALES DESDE GITHUB

Como ya tenemos el proyecto completo, al crear el repositorio resulta más sencillo dejar sin marcar opciones como:

- Add a README file;
- Add .gitignore;
- Choose a license.

Nuestro proyecto ya tiene sus propios archivos.

Presioná:

**Create repository**

---

# 26. SUBIR LOS ARCHIVOS DESDE EL NAVEGADOR

Una vez creado el repositorio vacío, GitHub mostrará varias formas de subir contenido.

Elegí:

**uploading an existing file**

o:

**Add file → Upload files**

---

# 27. QUÉ DEBÉS SUBIR

Tenés que subir el CONTENIDO de la carpeta descomprimida, no un único ZIP.

Debés terminar viendo en GitHub:

```text
.github
assets
css
js
supabase
.gitignore
.nojekyll
admin.html
index.html
README.md
PUBLICAR-EN-GITHUB.md
```

## NO DEBE QUEDAR ASÍ

Incorrecto:

```text
campeonato_futbol_REPOSITORIO_GITHUB.zip
```

GitHub Pages no descomprime automáticamente ese archivo.

---

# 28. MUY IMPORTANTE: LA CARPETA `.github`

Verificá que se haya cargado:

```text
.github/workflows/pages.yml
```

Si falta, el flujo automático de publicación no estará disponible.

Después de subir los archivos, podés hacer clic en la carpeta:

```text
.github
```

y comprobar que dentro exista:

```text
workflows/pages.yml
```

---

# 29. CONFIRMAR LA CARGA DE ARCHIVOS

En la parte inferior de la pantalla de Upload files aparece la sección para confirmar los cambios.

Podés escribir un mensaje como:

```text
Publicar formulario Campeonato de Fútbol 2026
```

Presioná:

**Commit changes**

Asegurate de que los cambios queden en la rama:

```text
main
```

---

# 30. COMPROBAR `config.js` EN GITHUB

Una vez cargado todo:

1. Entrá a la carpeta:

```text
js
```

2. Abrí:

```text
config.js
```

3. Comprobá que ya NO diga:

```text
PEGAR_AQUI_PROJECT_URL
```

ni:

```text
PEGAR_AQUI_PUBLISHABLE_KEY
```

Debe aparecer tu Project URL y tu Publishable key.

---

# 31. ACTIVAR GITHUB PAGES

Dentro del repositorio:

1. Entrá en:

   **Settings**

2. En el menú lateral buscá:

   **Pages**

Normalmente se encuentra dentro de:

**Code and automation → Pages**

3. Buscá:

   **Build and deployment**

4. En:

   **Source**

elegí:

```text
GitHub Actions
```

No hace falta crear otro workflow porque el proyecto ya contiene:

```text
.github/workflows/pages.yml
```

---

# 32. COMPROBAR GITHUB ACTIONS

Ahora abrí la pestaña:

**Actions**

Debería aparecer un workflow llamado:

```text
Publicar en GitHub Pages
```

Abrilo.

Cuando la ejecución haya terminado correctamente, debería verse en verde.

El flujo utiliza el contenido de la rama:

```text
main
```

y publica el sitio.

---

# 33. OBTENER LA URL PÚBLICA

Volvé a:

**Settings → Pages**

GitHub mostrará la dirección publicada.

Normalmente tendrá este formato:

```text
https://TU-USUARIO.github.io/NOMBRE-REPOSITORIO/
```

Por ejemplo:

```text
https://nicolaslugo.github.io/campeonato-futbol-2026/
```

Ese es el enlace que podés compartir para las inscripciones.

---

# 34. URL DEL PANEL ADMINISTRATIVO

El panel utiliza el mismo dominio agregando:

```text
admin.html
```

Ejemplo:

```text
https://nicolaslugo.github.io/campeonato-futbol-2026/admin.html
```

No hace falta agregar esa dirección a carteles públicos.

Debe utilizarla la organización.

---

# PARTE D — PRUEBA COMPLETA DEL SISTEMA

# 35. PRUEBA 1 — ABRIR EL FORMULARIO

Ingresá al enlace público de GitHub Pages.

Deberías ver:

- encabezado del campeonato;
- período de inscripción;
- categorías;
- Paso 1 de 5.

Si aparece un mensaje:

```text
Falta configurar Supabase
```

revisá `js/config.js`.

---

# 36. PRUEBA 2 — CREAR UNA INSCRIPCIÓN DE PRUEBA

Completá una inscripción de prueba.

Recordá que el formulario exige:

- mínimo 5 integrantes;
- máximo 10;
- edades válidas;
- teléfonos;
- cédulas;
- documentación;
- vencimiento de carné;
- autorizaciones correspondientes.

Para hacer una prueba deberás utilizar archivos PDF/JPG/PNG válidos.

No uses documentación real de terceras personas únicamente para probar.

---

# 37. PRUEBA 3 — COMPROBAR EL NÚMERO

Al finalizar correctamente debería aparecer un número similar a:

```text
CF2026-001
```

Esto indica que la inscripción se confirmó en Supabase.

---

# 38. PRUEBA 4 — COMPROBAR EN SUPABASE

En Supabase ingresá a:

**Table Editor → teams**

Debería aparecer el equipo.

También podés revisar:

```text
participants
documents
```

---

# 39. PRUEBA 5 — COMPROBAR LOS ARCHIVOS

Ingresá en:

**Storage → documentos**

Deberían aparecer carpetas/archivos correspondientes a la inscripción.

No cambies la privacidad del bucket.

---

# 40. PRUEBA 6 — INGRESAR AL PANEL

Abrí:

```text
TU-URL/admin.html
```

Ingresá:

- correo del administrador;
- contraseña.

Si el usuario fue agregado correctamente a:

```text
admin_users
```

debería ingresar al panel.

---

# 41. QUÉ PODÉS HACER EN EL PANEL

El panel permite:

- ver total de equipos;
- ver equipos pendientes;
- ver confirmados;
- ver cantidad de participantes;
- buscar por:
  - número de inscripción;
  - equipo;
  - responsable;
  - participante;
  - cédula;
- filtrar categorías;
- filtrar estados;
- abrir una inscripción;
- ver documentación;
- cambiar estado del equipo;
- cambiar estado documental;
- escribir observaciones;
- exportar CSV.

---

# 42. ABRIR DOCUMENTACIÓN

Al presionar:

**Ver cédula**

o:

**Ver carné**

el sistema genera una dirección temporal.

No utiliza un enlace público permanente.

Esto es intencional para proteger la documentación.

---

# PARTE E — ACTUALIZAR LA WEB MÁS ADELANTE

# 43. CÓMO CAMBIAR UN TEXTO

Si necesitás cambiar algo en la página:

1. Entrá al repositorio.
2. Abrí el archivo correspondiente.
3. Presioná el ícono del lápiz:

   **Edit this file**

4. Hacé el cambio.
5. Presioná:

   **Commit changes**

El workflow de GitHub Pages volverá a publicarse automáticamente.

---

# 44. ARCHIVOS PRINCIPALES

## Para cambiar textos o estructura del formulario

```text
index.html
```

## Para cambiar el panel

```text
admin.html
```

## Para modificar estilos

```text
css/styles.css
```

## Para modificar lógica de inscripción

```text
js/app.js
```

## Para modificar panel administrativo

```text
js/admin.js
```

## Para cambiar datos de conexión con Supabase

```text
js/config.js
```

## Para cambiar estructura o reglas de base de datos

```text
supabase/schema.sql
```

No ejecutes nuevamente `schema.sql` con modificaciones sin saber qué cambio estás aplicando.

---

# 45. CAMBIAR LA IMAGEN PRINCIPAL

La imagen utilizada por el proyecto se encuentra en:

```text
assets/placa-campeonato.jpeg
```

Si reemplazás la imagen manteniendo exactamente ese nombre, no será necesario modificar el HTML.

---

# PARTE F — SEGURIDAD

# 46. QUÉ SÍ PUEDE ESTAR EN GITHUB

Puede estar en GitHub:

- HTML;
- CSS;
- JavaScript;
- `Project URL`;
- `Publishable key`;
- SQL de creación;
- imágenes públicas.

La Publishable key está pensada para utilizarse en aplicaciones del lado del navegador.

La seguridad se complementa con las políticas RLS incluidas en el proyecto.

---

# 47. QUÉ NUNCA DEBE ESTAR EN GITHUB

Nunca subir:

- contraseña de Supabase;
- contraseña del administrador;
- Secret key;
- `service_role`;
- copias descargadas de cédulas;
- copias descargadas de carnés;
- exportaciones CSV reales con datos personales.

Si por error se publica una clave secreta, no alcanza con borrar el archivo del último commit: la clave debe considerarse comprometida y rotarse/reemplazarse desde el proveedor correspondiente.

---

# 48. NO HACER PÚBLICO EL BUCKET

En Supabase:

```text
Storage → documentos
```

debe continuar siendo privado.

Los documentos sensibles no deben servirse mediante URLs públicas.

---

# 49. NO QUITAR RLS

El archivo SQL activa seguridad de filas:

```text
Row Level Security
```

No desactives RLS en:

- `teams`;
- `participants`;
- `documents`;
- `admin_users`.

Las reglas del proyecto dependen de esa protección.

---

# 50. FINALIZADO EL PERÍODO DE INSCRIPCIÓN

El formulario está programado para admitir inscripciones:

```text
Desde: 26/08/2026
Hasta: 11/09/2026 inclusive
```

Además del control del navegador, Supabase valida el período en el servidor.

Por lo tanto, modificar solo JavaScript no debería permitir inscripciones fuera del período definido en la base de datos.

---

# PARTE G — SOLUCIÓN DE PROBLEMAS

# 51. ERROR: “FALTA CONFIGURAR SUPABASE”

Revisá:

```text
js/config.js
```

Debe contener valores reales.

Incorrecto:

```javascript
SUPABASE_URL: "PEGAR_AQUI_PROJECT_URL"
```

Correcto:

```javascript
SUPABASE_URL: "https://xxxx.supabase.co"
```

---

# 52. ERROR: LA PÁGINA DE GITHUB DA 404

Comprobá:

1. `Settings → Pages`.
2. Source = `GitHub Actions`.
3. Existe:

```text
.github/workflows/pages.yml
```

4. La pestaña Actions no muestra un error.
5. El archivo:

```text
index.html
```

está en la raíz del repositorio.

---

# 53. ERROR: ACTIONS APARECE EN ROJO

Abrí:

**Actions → Publicar en GitHub Pages**

Entrá al trabajo que falló.

Revisá el paso marcado en rojo.

Comprobá especialmente que:

```text
.github/workflows/pages.yml
```

se haya cargado completo.

---

# 54. ERROR: NO PUEDO SUBIR DOCUMENTOS

Comprobá:

1. Ejecutaste todo `schema.sql`.
2. Existe el bucket:

```text
documentos
```

3. Es privado.
4. Las políticas RLS no fueron eliminadas.
5. `js/config.js` apunta al mismo proyecto Supabase donde ejecutaste el SQL.
6. El archivo es:
   - PDF;
   - JPG/JPEG;
   - PNG.
7. No supera 8 MB.

---

# 55. ERROR: “EL PERÍODO DE INSCRIPCIÓN NO ESTÁ HABILITADO”

El servidor acepta inscripciones únicamente entre:

```text
26/08/2026
```

y:

```text
11/09/2026
```

según la lógica incluida en `schema.sql`.

---

# 56. ERROR: EL ADMINISTRADOR EXISTE PERO NO TIENE PERMISOS

Esto significa que el usuario fue creado en:

```text
Authentication → Users
```

pero probablemente no fue agregado a:

```text
public.admin_users
```

Obtené su UUID y ejecutá nuevamente:

```sql
insert into public.admin_users(user_id, display_name)
values ('UUID_REAL', 'Organización');
```

---

# 57. ERROR AL AGREGAR EL ADMINISTRADOR: DUPLICATE KEY

Si aparece un error indicando que el `user_id` ya existe, probablemente el usuario ya tiene permisos administrativos.

Verificá:

```text
Table Editor → admin_users
```

---

# 58. EL ADMIN PUEDE ENTRAR PERO NO VE EQUIPOS

Comprobá que la inscripción esté realmente finalizada.

En:

```text
Table Editor → teams
```

la fila debería tener:

```text
is_submitted = true
```

El panel muestra únicamente inscripciones confirmadas.

---

# 59. LOS DOCUMENTOS NO SE ABREN EN ADMIN

Revisá:

- que el administrador haya iniciado sesión;
- que esté en `admin_users`;
- que el bucket sea `documentos`;
- que las políticas de Storage continúen activas;
- que el registro exista en la tabla `documents`.

---

# PARTE H — LISTA DE CONTROL FINAL

Antes de compartir públicamente el formulario comprobá:

- [ ] Proyecto Supabase creado.
- [ ] `schema.sql` ejecutado completo.
- [ ] Tablas creadas.
- [ ] Bucket `documentos` creado.
- [ ] Bucket `documentos` privado.
- [ ] RLS activado.
- [ ] Project URL copiado.
- [ ] Publishable key copiada.
- [ ] `js/config.js` configurado.
- [ ] Usuario administrador creado.
- [ ] UUID del administrador agregado a `admin_users`.
- [ ] Repositorio GitHub creado.
- [ ] Todos los archivos subidos.
- [ ] Carpeta `.github` subida.
- [ ] `pages.yml` visible.
- [ ] GitHub Pages configurado con GitHub Actions.
- [ ] Workflow Actions en verde.
- [ ] URL pública abre correctamente.
- [ ] `admin.html` abre correctamente.
- [ ] Prueba de inscripción realizada.
- [ ] Prueba de carga de documentos realizada.
- [ ] Prueba de panel administrativo realizada.
- [ ] Documentos siguen siendo privados.

---

# 60. DIRECCIONES FINALES

## Formulario público

```text
https://TU-USUARIO.github.io/TU-REPOSITORIO/
```

## Panel administrativo

```text
https://TU-USUARIO.github.io/TU-REPOSITORIO/admin.html
```

## Ejemplo

Si:

```text
Usuario GitHub: oficina-juventud-flores
Repositorio: campeonato-futbol-2026
```

el formulario será:

```text
https://oficina-juventud-flores.github.io/campeonato-futbol-2026/
```

y el panel:

```text
https://oficina-juventud-flores.github.io/campeonato-futbol-2026/admin.html
```

---

# 61. ORDEN RECOMENDADO RESUMIDO

Seguí este orden para evitar errores:

```text
1. Crear proyecto Supabase
2. Ejecutar schema.sql
3. Comprobar tablas y Storage
4. Copiar Project URL
5. Copiar Publishable key
6. Completar js/config.js
7. Crear usuario administrador
8. Agregar UUID a admin_users
9. Crear repositorio GitHub
10. Subir archivos completos
11. Verificar .github/workflows/pages.yml
12. Activar Settings → Pages → GitHub Actions
13. Comprobar Actions
14. Abrir enlace público
15. Probar una inscripción
16. Probar admin.html
```

---

# 62. FUENTES OFICIALES DE REFERENCIA

GitHub Pages:

https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

Crear repositorios en GitHub:

https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository

Subir archivos a GitHub:

https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository

Supabase API Keys:

https://supabase.com/docs/guides/getting-started/api-keys

Supabase Row Level Security:

https://supabase.com/docs/guides/database/postgres/row-level-security

Supabase Storage Access Control:

https://supabase.com/docs/guides/storage/security/access-control

---

# 63. NOTA FINAL

El formulario público está pensado para recibir información personal y documentación de participantes.

GitHub Pages se utiliza únicamente para publicar la interfaz.

Los documentos se almacenan en Supabase Storage en un bucket privado y el acceso administrativo se controla mediante Supabase Authentication + RLS.

No conviertas el bucket de documentos en público y no publiques claves secretas en el repositorio.
