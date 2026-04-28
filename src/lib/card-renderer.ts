export async function downloadPostAsImage(post: {
  authorName: string;
  avatarUrl: string | null;
  content: string;
  themeClass: string;
  templateId?: "standard" | "executive" | "zen";
}) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const template = post.templateId || "standard";
  canvas.width = 1080;
  canvas.height = 1350;

  // Strip any [T:xxx] or [P:xxx] tags from content
  const cleanContent = post.content
    .replace(/^\[T:\w+\]/, "")
    .replace(/\[P:[\w-]+\]/g, "")
    .trim();

  const isAr = /[\u0600-\u06FF]/.test(cleanContent);

  // Helper: rounded rect without roundRect API
  const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // --- 1. Backgrounds ---
  const drawBackground = () => {
    if (template === "executive") {
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Gold Border
      ctx.strokeStyle = "#92400e";
      ctx.lineWidth = 40;
      ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
      // Inner gold accent line
      ctx.strokeStyle = "#d97706";
      ctx.lineWidth = 2;
      ctx.strokeRect(50, 50, canvas.width - 100, canvas.height - 100);
      return;
    }

    if (template === "zen") {
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Subtle radial glow
      const zenGrd = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, 700);
      zenGrd.addColorStop(0, "rgba(99, 102, 241, 0.08)");
      zenGrd.addColorStop(1, "transparent");
      ctx.fillStyle = zenGrd;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Standard Glassy logic
    const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (post.themeClass.includes("indigo") || post.themeClass.includes("midnight")) {
      grd.addColorStop(0, "#0f172a"); grd.addColorStop(1, "#312e81");
    } else if (post.themeClass.includes("emerald") || post.themeClass.includes("forest") || post.themeClass.includes("aurora")) {
      grd.addColorStop(0, "#064e3b"); grd.addColorStop(1, "#059669");
    } else if (post.themeClass.includes("amber") || post.themeClass.includes("dawn")) {
      grd.addColorStop(0, "#1c1007"); grd.addColorStop(1, "#78350f");
    } else if (post.themeClass.includes("rose") || post.themeClass.includes("sunset")) {
      grd.addColorStop(0, "#1a0a0f"); grd.addColorStop(1, "#9f1239");
    } else if (post.themeClass.includes("blue") || post.themeClass.includes("ocean")) {
      grd.addColorStop(0, "#0c1a2e"); grd.addColorStop(1, "#1e40af");
    } else if (post.themeClass.includes("violet") || post.themeClass.includes("royal")) {
      grd.addColorStop(0, "#0f0a1a"); grd.addColorStop(1, "#5b21b6");
    } else {
      grd.addColorStop(0, "#020617"); grd.addColorStop(1, "#0f172a");
    }
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative blobs
    ctx.globalAlpha = 0.25;
    const blobGrd = ctx.createRadialGradient(200, 400, 0, 200, 400, 600);
    blobGrd.addColorStop(0, "#6366f1"); blobGrd.addColorStop(1, "transparent");
    ctx.fillStyle = blobGrd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const blobGrd2 = ctx.createRadialGradient(900, 1000, 0, 900, 1000, 500);
    blobGrd2.addColorStop(0, "#a78bfa"); blobGrd2.addColorStop(1, "transparent");
    ctx.fillStyle = blobGrd2;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0;
  };

  drawBackground();

  // --- 2. Content Placement ---
  const margin = 120;
  const cardW = canvas.width - (margin * 2);
  const cardH = template === "zen" ? 800 : 1000;
  const cardX = margin;
  const cardY = (canvas.height - cardH) / 2;

  if (template === "standard") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    drawRoundRect(cardX, cardY, cardW, cardH, 50);
    ctx.fill();
    // Glass border
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    drawRoundRect(cardX, cardY, cardW, cardH, 50);
    ctx.stroke();
  }

  // --- 3. User & Branding ---
  ctx.fillStyle = template === "executive" ? "#d97706" : "#ffffff";
  ctx.textAlign = isAr ? "right" : "left";
  const avatarX = isAr ? cardX + cardW - 100 : cardX + 100;
  
  // Avatar Draw
  if (post.avatarUrl && template !== "zen") {
    try {
      const avatar = new Image();
      avatar.crossOrigin = "anonymous";
      avatar.src = post.avatarUrl;
      await new Promise((res, rej) => { avatar.onload = res; avatar.onerror = rej; setTimeout(rej, 2000); });
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, cardY + 100, 55, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatar, avatarX - 55, cardY + 45, 110, 110);
      ctx.restore();
      // Avatar ring
      ctx.strokeStyle = template === "executive" ? "#d97706" : "rgba(255,255,255,0.3)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(avatarX, cardY + 100, 58, 0, Math.PI * 2);
      ctx.stroke();
    } catch (e) {
      // Draw placeholder circle
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.beginPath();
      ctx.arc(avatarX, cardY + 100, 55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (template !== "zen") {
    // Author Name
    ctx.fillStyle = template === "executive" ? "#d97706" : "#ffffff";
    ctx.font = "bold 40px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = isAr ? "right" : "left";
    const nameX = isAr ? avatarX - 80 : avatarX + 80;
    ctx.fillText(post.authorName, nameX, cardY + 105);
    
    // Subtitle
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "28px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("via Elham ✦", nameX, cardY + 145);
  }

  // --- 4. Main Text ---
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  
  const fontSize = cleanContent.length > 120 ? 54 : cleanContent.length > 60 ? 64 : 72;
  
  if (template === "executive") {
    ctx.font = `italic 700 ${fontSize}px 'Georgia', 'Times New Roman', serif`;
    ctx.fillStyle = "#f5f0e8";
  } else if (template === "zen") {
    ctx.font = `300 ${fontSize + 8}px 'Segoe UI', Arial, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
  } else {
    ctx.font = `700 ${fontSize}px 'Segoe UI', Arial, sans-serif`;
  }

  // Word wrap
  const wrapText = (text: string, maxWidth: number): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = words[0] || "";
    for (let i = 1; i < words.length; i++) {
      const width = ctx.measureText(currentLine + " " + words[i]).width;
      if (width < maxWidth) {
        currentLine += " " + words[i];
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const lines = wrapText(cleanContent, cardW - 140);
  const lineHeight = fontSize + 30;
  const totalTextH = lines.length * lineHeight;
  
  // Center text vertically in card
  const textAreaTop = template === "zen" ? cardY + (cardH / 2) - (totalTextH / 2) : cardY + 220;
  let textY = textAreaTop + lineHeight;
  
  lines.forEach(l => {
    ctx.fillText(l, canvas.width / 2, textY);
    textY += lineHeight;
  });

  // --- 5. Decorative Quote Marks ---
  if (template !== "zen") {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.font = `900 280px 'Georgia', serif`;
    ctx.textAlign = "left";
    ctx.fillText("\u201C", cardX + 40, cardY + 300);
  }

  // --- 6. Branding Footer ---
  ctx.textAlign = "center";
  
  if (template === "executive") {
    // Gold line separator
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin + 80, canvas.height - 180);
    ctx.lineTo(canvas.width - margin - 80, canvas.height - 180);
    ctx.stroke();
    ctx.fillStyle = "#d97706";
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  }
  
  ctx.font = "300 32px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("إلهام  •  ELHAM", canvas.width / 2, canvas.height - 120);
  
  // Small watermark
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.font = "22px 'Segoe UI', Arial, sans-serif";
  ctx.fillText("elham.app", canvas.width / 2, canvas.height - 78);

  const dataUrl = canvas.toDataURL("image/png", 1.0);
  const link = document.createElement("a");
  link.download = `Elham_${template}_${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
}
