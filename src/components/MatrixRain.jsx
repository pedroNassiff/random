import React, { useEffect, useRef } from 'react';

export default function MatrixRain({ opacity = 1.0 }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  // 🔥 SEPARAR: container es el elemento padre, ctx es el contexto
  const container = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;

  // Texto de la receta del asado en japonés
  const recipeText = `
火の作り方は芸術です。完璧な焼き加減を実現するために重要です。
硬くて乾燥した薪を選びます。果樹やケブラチョの木が最適です。
グリルを適切な高さに配置します。
灰や炭の残りをきれいにします。
炭の土台を作ります。中央に木炭を置きます。
火の強さをコントロールします。炎が強すぎる場合は炭を散らします。
炭が熾火になるのを待ちます。アルゼンチンアサドの秘密は炭火で調理することです。
熾火を均等に分散させます。熊手で熾火をグリルの下に均等に広げます。
調理を開始します。熱い熾火の層ができたら調理を始めます。
チミチュリソース：ニンニク、パセリ、酢、油、スパイスをベースにしたソース。
クリオージャソース：トマト、玉ねぎ、ピーマン、ニンニク、油の混合物。
焼きピーマン：焼いた赤ピーマンは色鮮やかで美味しい。
焼きじゃがいも：同じグリルで調理されるクラシックな付け合わせ。
プロヴォレタ：プロヴォローネチーズをベースにした前菜。
自家製パン：良いアサドにはパンが欠かせません。
肉の選択は重要です。アサド、バシオ、エントラーニャなどの部位が人気です。
チョリソー：クラシックなチョリパンを作ります。
モルシージャ：豚や牛の血、玉ねぎ、その他の調味料で作られます。
チンチュリネス：牛の小腸で、外はカリカリ、中は柔らかく調理します。
腎臓とモジェハス：アルゼンチンアサドの伝統的な部分です。
`.trim();

  const characters = recipeText.split('');
  const fontSize = 16;
  const columns = Math.floor(canvas.width / fontSize);
  
  // Cada columna es una gota con trail
  const drops = [];
  for (let i = 0; i < columns; i++) {
    drops[i] = {
      y: -(Math.random() * canvas.height),
      speed: Math.random() * 0.5 + 0.15,
      length: Math.floor(Math.random() * 15) + 10,
      chars: [],
      active: Math.random() > 0.3,
      resetDelay: 0
    };
    
    for (let j = 0; j < drops[i].length; j++) {
      drops[i].chars.push(characters[Math.floor(Math.random() * characters.length)]);
    }
  }

  let frame = 0;

  function draw() {
    // 🔥 Usar ctx, no container
    ctx.fillStyle = `rgba(0, 0, 0, ${0.08 * opacity})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${fontSize}px monospace`;

    for (let i = 0; i < drops.length; i++) {
      const drop = drops[i];
      
      if (!drop.active) {
        drop.resetDelay--;
        if (drop.resetDelay <= 0) {
          drop.active = Math.random() > 0.7;
          if (drop.active) {
            drop.y = -drop.length * fontSize;
            drop.speed = Math.random() * 0.3 + 0.15;
          }
        }
        continue;
      }

      const x = i * fontSize;

      for (let j = 0; j < drop.length; j++) {
        const charY = drop.y - j * fontSize;
        
        if (charY < 0 || charY > canvas.height) continue;

        const char = drop.chars[j];
        
        let alpha;
        if (j === 0) {
          alpha = 1.0;
          ctx.fillStyle = `rgba(220, 255, 220, ${alpha * opacity})`;
        } else if (j < 3) {
          alpha = 0.9 - (j * 0.2);
          ctx.fillStyle = `rgba(0, 255, 65, ${alpha * opacity})`;
        } else {
          alpha = Math.max(0, 1 - (j / drop.length));
          const green = Math.floor(255 * alpha);
          ctx.fillStyle = `rgba(0, ${green}, ${Math.floor(green * 0.25)}, ${alpha * opacity})`;
        }

        ctx.fillText(char, x, charY);

        if (frame % 4 === 0 && Math.random() > 0.95) {
          drop.chars[j] = characters[Math.floor(Math.random() * characters.length)];
        }
      }

      drop.y += drop.speed;

      if (drop.y - drop.length * fontSize > canvas.height) {
        drop.active = false;
        drop.resetDelay = Math.floor(Math.random() * 100) + 50;
        
        for (let j = 0; j < drop.length; j++) {
          drop.chars[j] = characters[Math.floor(Math.random() * characters.length)];
        }
      }
    }

    frame++;
    animationRef.current = requestAnimationFrame(draw);
  }

  draw();

  const handleResize = () => {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  };
  window.addEventListener('resize', handleResize);

  return () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    window.removeEventListener('resize', handleResize);
  };
}, [opacity]);

  return (
    <canvas
      ref={canvasRef}
    className="absolute inset-0 w-full h-full pointer-events-none" 
      style={{ opacity }}
    />
  );
}