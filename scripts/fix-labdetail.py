import sys

path = '/Users/pedronassiff/Desktop/proyectos/random/src/pages/LabDetail.jsx'
with open(path, 'r') as f:
    src = f.read()

# 1. Add import
old = "import BrainDetail from './BrainDetail'"
new = "import BrainDetail from './BrainDetail'\nimport { EditorPanel, SourceButton, EDITOR_STYLES } from '../components/CodeEditor'"
if new not in src:
    src = src.replace(old, new, 1)
    print('import added')
else:
    print('import already present')

# 2. Remove local copies block
start_marker = '\n\n// Lab editor styles'
end_marker = '\n\n// Config full-screen por experimento'
si = src.find(start_marker)
ei = src.find(end_marker)
print(f'start={si}, end={ei}')
if si != -1 and ei != -1:
    src = src[:si] + src[ei:]
    print('local block removed')
else:
    print('markers not found - check manually')

with open(path, 'w') as f:
    f.write(src)

print(f'Done. Lines: {src.count(chr(10))}')
