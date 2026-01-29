python -c "
import asyncio
from bleak import BleakScanner

async def scan():
    print('🔍 Escaneando dispositivos BLE (15 segundos)...')
    print('   Asegúrate de que el Muse esté encendido y parpadeando azul\n')
    devices = await BleakScanner.discover(timeout=15.0)
    
    muse_found = False
    print(f'Dispositivos encontrados: {len(devices)}\n')
    
    for d in devices:
        name = d.name or 'Sin nombre'
        # Buscar Muse específicamente
        if 'muse' in name.lower():
            print(f'🎧 MUSE ENCONTRADO!')
            print(f'   Nombre: {name}')
            print(f'   Dirección: {d.address}')
            muse_found = True
        elif d.name:  # Mostrar otros con nombre
            print(f'   • {name}: {d.address}')
    
    if not muse_found:
        print('\n⚠️  No se encontró ningún Muse.')
        print('   Verifica que el LED parpadee en AZUL (no blanco fijo)')

asyncio.run(scan())
"







