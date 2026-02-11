# 🚀 Configuración de CI/CD con GitHub Actions

Este proyecto usa GitHub Actions para automatizar el deployment tanto del frontend como del backend.

## 📋 Workflows Configurados

### 1. Backend (Digital Ocean)
**Archivo:** `.github/workflows/deploy-backend.yml`

**Trigger:**
- Push a `main` que modifique archivos en `teoria-sintergica/brain-prototype/backend/`
- Ejecución manual desde la pestaña Actions en GitHub

**Proceso:**
1. Conecta al servidor via SSH
2. Hace `git pull` del código actualizado
3. Instala dependencias con pip
4. Reinicia el servicio systemd
5. Verifica que el servicio esté corriendo

### 2. Frontend (Vercel)
El frontend se despliega automáticamente en Vercel cuando:
- Hay push a `main` → despliega a producción
- Hay push a cualquier branch → crea preview deployment

## 🔐 Configuración de Secrets en GitHub

Para que el workflow funcione, necesitas configurar estos **secrets** en tu repositorio:

### Paso 1: Ve a la configuración del repositorio
```
GitHub Repository → Settings → Secrets and variables → Actions → New repository secret
```

### Paso 2: Agrega los siguientes secrets

| Secret Name | Descripción | Valor |
|------------|-------------|-------|
| `SERVER_HOST` | IP del servidor Digital Ocean | `142.93.47.46` |
| `SERVER_USER` | Usuario SSH para conectarse | `root` |
| `SSH_PRIVATE_KEY` | Clave SSH privada completa | Ver abajo ↓ |

### Cómo obtener la SSH_PRIVATE_KEY

En tu Mac, copia tu clave privada:

```bash
# Ver tu clave privada (la que usas para conectarte al servidor)
cat ~/.ssh/id_ed25519

# O si usas RSA:
cat ~/.ssh/id_rsa
```

**Copia TODO el contenido**, incluyendo las líneas:
```
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

⚠️ **IMPORTANTE:** 
- Esta clave es **privada** - nunca la compartas ni la subas al repositorio
- Solo agrégala como secret en GitHub
- Los secrets de GitHub están encriptados y solo son visibles durante la ejecución del workflow

## 🎯 Cómo Usar

### Deployment Automático
Simplemente haz push a `main`:

```bash
# Después de hacer cambios en el backend
git add teoria-sintergica/brain-prototype/backend/
git commit -m "feat: nuevo endpoint de analytics"
git push origin main
```

GitHub Actions detectará los cambios y automáticamente:
1. ✅ Ejecutará el workflow
2. ✅ Se conectará al servidor
3. ✅ Actualizará el código
4. ✅ Reiniciará el servicio

### Deployment Manual

Si quieres hacer deploy sin hacer push:

1. Ve a GitHub → Actions
2. Selecciona "Deploy Backend to Digital Ocean"
3. Click en "Run workflow"
4. Selecciona la rama y click "Run workflow"

## 📊 Monitorear el Deployment

### Desde GitHub:
- Ve a la pestaña **Actions** en tu repositorio
- Verás todos los workflows ejecutándose o completados
- Click en cualquiera para ver los logs en tiempo real

### Desde el servidor:
```bash
# Ver logs del servicio
ssh root@142.93.47.46 "journalctl -u brain-backend -f"

# Ver estado del servicio
ssh root@142.93.47.46 "systemctl status brain-backend"
```

## 🔧 Troubleshooting

### Error: "Host key verification failed"
Solución: Agrega la IP del servidor a known_hosts

```bash
ssh-keyscan -H 142.93.47.46 >> ~/.ssh/known_hosts
```

### Error: "Permission denied (publickey)"
Solución: Verifica que la SSH_PRIVATE_KEY en GitHub sea correcta

### El servicio no inicia después del deploy
Solución: Revisa los logs
```bash
ssh root@142.93.47.46 "journalctl -u brain-backend -n 50"
```

## 📝 Ventajas de usar GitHub Actions

✅ **Automatización completa** - No más `scp` manual
✅ **Historial de deployments** - Cada deployment queda registrado
✅ **Rollback fácil** - Puedes revertir a commits anteriores
✅ **Notificaciones** - GitHub te notifica si falla el deployment
✅ **Gratuito** - 2000 minutos/mes en plan free
✅ **Logs detallados** - Cada paso del deployment es visible

## 🎨 Frontend (Vercel)

El frontend ya está configurado en Vercel y se despliega automáticamente.

**URL de producción:** https://random-studio.vercel.app (o tu dominio custom)

**Vista previa:** Cada PR genera una URL de preview automáticamente

## 🔄 Workflow Completo

```mermaid
graph LR
    A[git push] --> B{¿Qué cambió?}
    B -->|Backend| C[GitHub Actions]
    B -->|Frontend| D[Vercel]
    C --> E[SSH a Digital Ocean]
    E --> F[git pull]
    F --> G[pip install]
    G --> H[systemctl restart]
    H --> I[✅ Deployed]
    D --> J[Build]
    J --> K[Deploy]
    K --> L[✅ Deployed]
```

## 📚 Recursos

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [SSH Action Marketplace](https://github.com/marketplace/actions/ssh-remote-commands)
- [Vercel Documentation](https://vercel.com/docs)

---

**Última actualización:** 11 de Febrero, 2026
