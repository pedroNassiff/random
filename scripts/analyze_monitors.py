from PIL import Image
import os

base = '/Users/pedronassiff/Desktop/proyectos/random/src/img/lab'
for i in range(1, 6):
    path = os.path.join(base, f'monitor{i}.png')
    img = Image.open(path).convert('RGBA')
    W, H = img.size
    data = img.load()
    minX, minY = W, H
    maxX, maxY = 0, 0
    count = 0
    for y in range(H):
        for x in range(W):
            a = data[x, y][3]
            if a < 30:
                if x < minX: minX = x
                if x > maxX: maxX = x
                if y < minY: minY = y
                if y > maxY: maxY = y
                count += 1
    sw = maxX - minX + 1
    sh = maxY - minY + 1
    print(f"monitor{i}.png ({W}x{H}) | {count} px transparentes")
    print(f"  px  : x={minX}-{maxX}  y={minY}-{maxY}  ({sw}x{sh})")
    print(f"  %%  : left={minX/W*100:.1f}  top={minY/H*100:.1f}  width={sw/W*100:.1f}  height={sh/H*100:.1f}")
    print()
