from PIL import Image
import numpy as np

# Cargar la imagen
img = Image.open('lavacafull_image.png').convert('RGBA')
data = np.array(img)

# Obtener los canales RGB y Alpha
r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]

# Crear una máscara para detectar píxeles blancos o casi blancos
# Umbral para considerar un pixel como "blanco" (ajustable)
threshold = 240
white_mask = (r > threshold) & (g > threshold) & (b > threshold)

# Hacer transparentes los píxeles blancos
a[white_mask] = 0

# También hacer gradualmente transparente los píxeles grisáceos claros
gray_threshold = 200
gray_mask = (r > gray_threshold) & (g > gray_threshold) & (b > gray_threshold) & ~white_mask
# Reducir la opacidad de los grises claros proporcionalmente
gray_avg = (r[gray_mask].astype(float) + g[gray_mask].astype(float) + b[gray_mask].astype(float)) / 3
a[gray_mask] = (255 - ((gray_avg - gray_threshold) / (255 - gray_threshold) * 255)).astype(np.uint8)

# Actualizar el canal alpha
data[:, :, 3] = a

# Crear nueva imagen con el fondo transparente
result = Image.fromarray(data, 'RGBA')

# Guardar la imagen procesada
result.save('lavacafull_image_transparent.png')
print('✓ Imagen procesada y guardada como lavacafull_image_transparent.png')
print(f'  Dimensiones: {result.size[0]}x{result.size[1]}')
