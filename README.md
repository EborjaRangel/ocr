# Lector INE

Aplicación web en Next.js, TypeScript, Tailwind, Formik y Yup para leer una foto de la credencial de elector (INE) y extraer:

- Nombre
- Apellido paterno
- Apellido materno
- CURP
- Sección

Cada lectura se acumula en `data/registros.csv`.

## Uso

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000), sube o toma una foto del **frente** de la INE, pulsa **Leer credencial**, revisa los campos y guarda. El OCR corre en el navegador; solo los datos extraídos se escriben en el CSV.
