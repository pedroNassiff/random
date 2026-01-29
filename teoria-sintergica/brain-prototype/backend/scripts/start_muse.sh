#!/bin/bash
# =============================================================================
# 🎧 MUSE 2 CONNECTION SCRIPT
# =============================================================================
# Conecta el Muse 2 e inicia el streaming LSL
#
# Uso:
#   ./scripts/start_muse.sh           # Busca y conecta automáticamente
#   ./scripts/start_muse.sh scan      # Solo escanea dispositivos
#   ./scripts/start_muse.sh <address> # Conecta a dirección específica
#
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
VENV_PATH="$BACKEND_DIR/venv/bin/activate"

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Dirección del Muse (se puede pasar como argumento o usar la guardada)
MUSE_ADDRESS_FILE="$BACKEND_DIR/.muse_address"
MUSE_ADDRESS=""

echo -e "${BLUE}"
echo "============================================================"
echo "   🎧 MUSE 2 CONNECTION SCRIPT"
echo "============================================================"
echo -e "${NC}"

# Activar venv
if [ -f "$VENV_PATH" ]; then
    source "$VENV_PATH"
    echo -e "${GREEN}✓ Virtual environment activated${NC}"
else
    echo -e "${RED}❌ Virtual environment not found at $VENV_PATH${NC}"
    echo "   Run: cd backend && python3 -m venv venv && pip install -r requirements.txt"
    exit 1
fi

# Función para escanear dispositivos
scan_devices() {
    echo -e "\n${BLUE}🔍 Scanning for Muse devices (15 seconds)...${NC}"
    echo "   Make sure your Muse is ON and LED is blinking BLUE"
    echo ""
    
    python3 << 'EOF'
import asyncio
from bleak import BleakScanner

async def scan():
    devices = await BleakScanner.discover(timeout=15.0)
    
    muse_devices = []
    for d in devices:
        name = d.name or ''
        if 'muse' in name.lower():
            muse_devices.append((name, d.address))
            print(f"🎧 FOUND: {name} | {d.address}")
    
    if not muse_devices:
        print("❌ No Muse devices found")
        print("\nTroubleshooting:")
        print("  1. Make sure Muse is turned ON")
        print("  2. LED should blink BLUE (pairing mode)")
        print("  3. Disconnect from phone app first")
        return None
    
    # Guardar la primera dirección encontrada
    if muse_devices:
        with open('.muse_address', 'w') as f:
            f.write(muse_devices[0][1])
        return muse_devices[0][1]
    return None

result = asyncio.run(scan())
if result:
    print(f"\n✅ Address saved to .muse_address")
EOF
}

# Función para conectar
connect_muse() {
    local address=$1
    
    echo -e "\n${BLUE}📡 Connecting to Muse: ${address}${NC}"
    echo -e "${YELLOW}   Press Ctrl+C to stop streaming${NC}"
    echo ""
    
    # Iniciar muselsl stream
    muselsl stream --address "$address"
}

# Función para mostrar ayuda
show_help() {
    echo "Usage: $0 [command|address]"
    echo ""
    echo "Commands:"
    echo "  (none)     Scan and connect automatically"
    echo "  scan       Only scan for devices"
    echo "  <address>  Connect to specific address"
    echo "  help       Show this help"
    echo ""
    echo "Examples:"
    echo "  $0                                              # Auto scan & connect"
    echo "  $0 scan                                         # Only scan"
    echo "  $0 6D5F179A-C0AF-DCA5-3B60-7812EF8E293F        # Connect to address"
    echo ""
}

# Main
case "$1" in
    help|--help|-h)
        show_help
        exit 0
        ;;
    scan)
        scan_devices
        exit 0
        ;;
    "")
        # Auto mode: check saved address or scan
        if [ -f "$MUSE_ADDRESS_FILE" ]; then
            MUSE_ADDRESS=$(cat "$MUSE_ADDRESS_FILE")
            echo -e "${GREEN}📍 Found saved address: $MUSE_ADDRESS${NC}"
            echo -n "   Use this address? [Y/n]: "
            read -r response
            if [[ "$response" =~ ^[Nn]$ ]]; then
                scan_devices
                if [ -f "$MUSE_ADDRESS_FILE" ]; then
                    MUSE_ADDRESS=$(cat "$MUSE_ADDRESS_FILE")
                else
                    exit 1
                fi
            fi
        else
            scan_devices
            if [ -f "$MUSE_ADDRESS_FILE" ]; then
                MUSE_ADDRESS=$(cat "$MUSE_ADDRESS_FILE")
            else
                exit 1
            fi
        fi
        connect_muse "$MUSE_ADDRESS"
        ;;
    *)
        # Assume it's an address
        MUSE_ADDRESS="$1"
        echo "$MUSE_ADDRESS" > "$MUSE_ADDRESS_FILE"
        connect_muse "$MUSE_ADDRESS"
        ;;
esac
