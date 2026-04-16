# Sistema de Contexto para Claude — Random Lab

## Estructura de archivos

```
project-root/
├── CLAUDE.md                    # Contexto específico del proyecto (ya lo haces)
└── .claude/
    ├── GLOBAL.md                # Quién eres tú y tus defaults globales
    └── skills/
        ├── think.md             # /think — proceso de ingeniería (el core del artículo)
        ├── content.md           # /content — LinkedIn y content creation
        ├── security.md          # /security — adversarial security review
        └── product.md           # /product — decisiones de producto / arquitectura
```

## Cómo usarlo

1. **GLOBAL.md** va en `.claude/` en todos tus proyectos (o en tu home si usas Claude Code globalmente)
2. **CLAUDE.md** va en la raíz de cada proyecto con contexto específico
3. Los skills se activan con `/think`, `/content`, `/security`, `/product` en Claude Code
4. En Claude web/chat: pega el contenido del skill relevante al inicio de la sesión

## Flujo por tipo de tarea

| Tarea | Skill a usar |
|-------|-------------|
| Feature nueva / bug complejo | `/think` |
| Post de LinkedIn / descripción de proyecto | `/content` |
| Revisar endpoint antes de producción | `/security` |
| Decidir arquitectura / propuesta a cliente | `/product` |
| Legacy migration | `/think` + `/security` |
| Creative/Three.js | `/think` (modo creativo) |
