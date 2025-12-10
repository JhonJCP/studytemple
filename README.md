# STUDY TEMPLE

Plataforma de preparación de oposiciones potenciada por IA (Gemini 3.0 Pro).

## 🧠 Arquitectura del Sistema

Study Temple integra 5 módulos principales para optimizar el estudio:

1.  **Gran Biblioteca**: Gestión de documentos y normativa.
2.  **Calendario Inteligente**: Planificación con repetición espaciada y carga de planes JSON.
3.  **Zona de Estudio**: Generación de contenido, podcasts y widgets interactivos por IA.
4.  **Supuestos Prácticos**: Análisis profundo de casos reales.
5.  **Dojo (Review)**: Flashcards y Tests generados automáticamente.

---

## 🚀 Flujo de Despliegue Automático (Instrucciones para Agentes)

Este proyecto está configurado con **Vercel** para Despliegue Continuo (CI/CD). Cada vez que se hace un `push` a la rama `main` en GitHub, Vercel detecta los cambios, construye la aplicación y actualiza la versión online automáticamente.

### 🤖 Cómo desplegar cambios a producción

Si eres un agente de IA o un desarrollador y has realizado modificaciones en el código, sigue estos pasos estrictos para que los cambios se reflejen en la web:

1.  **Verificar Estado**: Asegúrate de estar en la raíz del proyecto (`studytemple/`).
    ```bash
    git status
    ```

2.  **Añadir Cambios**: Añade los archivos modificados al área de preparación (staging).
    ```bash
    git add -A
    ```

3.  **Confirmar Cambios (Commit)**: Crea un commit con un mensaje descriptivo siguiendo la convención [Conventional Commits](https://www.conventionalcommits.org/) (feat, fix, docs, style, refactor, etc.).
    ```bash
    git commit -m "tipo(scope): descripción breve de los cambios"
    ```
    *Ejemplo: `git commit -m "feat(calendar): auto-navigate to plan dates after loading"`*

4.  **Subir Cambios (Push)**: Envía los cambios al repositorio remoto en GitHub.
    ```bash
    git push origin main
    ```

### ✅ Qué sucede después del Push

1.  GitHub recibe el código.
2.  Vercel detecta el nuevo commit en `main`.
3.  Vercel inicia el proceso de "Build".
4.  Si el build es exitoso, Vercel despliega la nueva versión en `https://studytemple.vercel.app/`.
5.  El proceso total suele tardar entre **1 y 2 minutos**.

### ⚠️ Solución de Problemas Comunes

*   **Error en Push**: Si recibes un error de que la rama remota tiene cambios que no tienes localmente, primero debes hacer `git pull origin main` para traer los cambios y resolver conflictos si los hay.
*   **Deploy Fallido**: Si Vercel falla el build (se puede ver en el dashboard de Vercel), revisa que no hayas introducido errores de TypeScript o Linting antes de hacer push. Usa `npm run build` localmente para verificar antes de subir si tienes dudas.

---

## 🛠️ Desarrollo Local

Para correr el proyecto en tu máquina:

```bash
cd studytemple
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.
