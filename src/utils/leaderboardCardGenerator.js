/**
 * SayBD - Top 3 Leaderboard Social Card Generator
 * Renders a high-resolution 1080x1350 social-ready PNG image
 * using HTML5 Canvas featuring the verified Top 3 students for the selected period.
 * 
 * Strict Compliance:
 * - SayBD branding, dark navy & purple theme, gold/silver/bronze accents
 * - Tagline: "Practice English. Connect. Improve."
 * - Selected leaderboard period (Today, Monthly, Yearly in Asia/Dhaka)
 * - Actual Top 3 students' latest avatars, names, ranks, and speaking durations
 * - Official SayBD URL & promotional invitation text
 * - NO referral links, referral codes, or tracking
 * - Safe: No phone numbers, emails, or private data
 */

import { formatSpeakingDuration } from './formatters.js';

export function getOfficialAppUrl() {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }
  return 'https://saybd.app';
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Safely load an image with CORS handling and graceful fallback
function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // Retry without crossOrigin if CORS was blocked
      const fallbackImg = new Image();
      fallbackImg.onload = () => resolve(fallbackImg);
      fallbackImg.onerror = () => resolve(null);
      fallbackImg.src = src;
    };
    img.src = src;
  });
}

export async function generateTopThreeLeaderboardCard({
  period = 'today',
  periodLabel = "Today's Top Speakers",
  dateSubtitle = 'Asia/Dhaka Calendar Day',
  topStudents = [],
  appUrl = getOfficialAppUrl(),
}) {
  return new Promise(async (resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const width = 1080;
      const height = 1350;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D context not available');
      }

      // Preload avatars for top 3 students
      const avatarImages = await Promise.all(
        topStudents.slice(0, 3).map((st) => loadImage(st.avatar_url))
      );

      // --- 1. Background Fill & Premium Dark Gradients ---
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#07090e');
      bgGrad.addColorStop(0.35, '#0b0f19');
      bgGrad.addColorStop(0.7, '#0e1322');
      bgGrad.addColorStop(1, '#07090e');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Gold ambient spotlight on top-center
      const topGoldGlow = ctx.createRadialGradient(width / 2, 280, 20, width / 2, 280, 500);
      topGoldGlow.addColorStop(0, 'rgba(245, 158, 11, 0.16)');
      topGoldGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = topGoldGlow;
      ctx.fillRect(0, 0, width, height);

      // Deep purple/indigo ambient glow on bottom
      const botIndigoGlow = ctx.createRadialGradient(width / 2, height - 200, 30, width / 2, height - 200, 550);
      botIndigoGlow.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
      botIndigoGlow.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = botIndigoGlow;
      ctx.fillRect(0, 0, width, height);

      // --- 2. Outer Decorative Frame ---
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, 30, 30, width - 60, height - 60, 36);
      ctx.stroke();

      // Corner gold accents
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.lineWidth = 3;
      // Top-left corner bracket
      ctx.beginPath();
      ctx.moveTo(30, 80);
      ctx.lineTo(30, 40);
      ctx.quadraticCurveTo(30, 30, 40, 30);
      ctx.lineTo(80, 30);
      ctx.stroke();
      // Top-right corner bracket
      ctx.beginPath();
      ctx.moveTo(width - 80, 30);
      ctx.lineTo(width - 40, 30);
      ctx.quadraticCurveTo(width - 30, 30, width - 30, 40);
      ctx.lineTo(width - 30, 80);
      ctx.stroke();

      // --- 3. Header: SayBD Branding & Official URL ---
      const headerY = 75;
      const iconX = 70;
      const iconSize = 64;

      // SayBD Logo Icon
      const iconGrad = ctx.createLinearGradient(iconX, headerY, iconX + iconSize, headerY + iconSize);
      iconGrad.addColorStop(0, '#6366f1');
      iconGrad.addColorStop(1, '#4338ca');
      ctx.fillStyle = iconGrad;
      drawRoundedRect(ctx, iconX, headerY, iconSize, iconSize, 18);
      ctx.fill();

      // Mic glyph inside logo
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(iconX + 32, headerY + 26, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(iconX + 32, headerY + 36);
      ctx.lineTo(iconX + 32, headerY + 48);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(iconX + 22, headerY + 48);
      ctx.lineTo(iconX + 42, headerY + 48);
      ctx.stroke();

      // Brand Title & Tagline
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 36px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('SayBD', iconX + iconSize + 18, headerY + 4);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 17px system-ui, -apple-system, sans-serif';
      ctx.fillText('Practice English. Connect. Improve.', iconX + iconSize + 18, headerY + 44);

      // App URL Pill
      const cleanUrl = appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const pillText = cleanUrl.length > 28 ? cleanUrl.substring(0, 26) + '...' : cleanUrl;
      ctx.font = '700 15px monospace, system-ui, sans-serif';
      const pillWidth = ctx.measureText(pillText).width + 36;
      const pillHeight = 36;
      const pillX = width - 70 - pillWidth;
      const pillY = headerY + 14;

      ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
      drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 18);
      ctx.fill();
      ctx.strokeStyle = 'rgba(129, 140, 248, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#a5b4fc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pillText, pillX + pillWidth / 2, pillY + pillHeight / 2);

      // Divider
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(70, 160);
      ctx.lineTo(width - 70, 160);
      ctx.stroke();

      // --- 4. Main Title & Period Announcement ---
      const titleY = 185;

      // Trophy Banner Badge
      const badgeText = `🏆 TOP SPEAKING CHAMPIONS`;
      ctx.font = '800 14px system-ui, -apple-system, sans-serif';
      const badgeWidth = ctx.measureText(badgeText).width + 32;
      const badgeHeight = 30;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      drawRoundedRect(ctx, 70, titleY, badgeWidth, badgeHeight, 15);
      ctx.fill();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, 86, titleY + badgeHeight / 2);

      // Period Headline
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 36px system-ui, -apple-system, sans-serif';
      ctx.fillText(periodLabel, 70, titleY + 40);

      // Subtitle
      ctx.fillStyle = '#34d399';
      ctx.font = '700 18px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Verified One-to-One English Speaking Practice • ${dateSubtitle}`, 70, titleY + 84);

      // --- 5. Top 3 Champions Showcase Cards ---
      const cardsStartY = 330;
      const cardHeight = 220;
      const cardWidth = width - 140; // 940px
      const cardGap = 20;

      const rankConfigs = [
        {
          rankNum: 1,
          title: '🥇 FIRST PLACE • CHAMPION',
          color: '#fbbf24', // Gold
          glowColor: 'rgba(245, 158, 11, 0.22)',
          borderColor: '#f59e0b',
          cardBg: 'rgba(30, 24, 10, 0.75)',
          badgeBg: '#f59e0b',
          badgeText: '#000000',
          avatarRing: '#f59e0b',
        },
        {
          rankNum: 2,
          title: '🥈 SECOND PLACE • RUNNER-UP',
          color: '#e2e8f0', // Silver
          glowColor: 'rgba(203, 213, 225, 0.16)',
          borderColor: '#94a3b8',
          cardBg: 'rgba(20, 24, 34, 0.75)',
          badgeBg: '#94a3b8',
          badgeText: '#0f172a',
          avatarRing: '#cbd5e1',
        },
        {
          rankNum: 3,
          title: '🥉 THIRD PLACE',
          color: '#f97316', // Bronze
          glowColor: 'rgba(217, 119, 6, 0.16)',
          borderColor: '#d97706',
          cardBg: 'rgba(28, 20, 16, 0.75)',
          badgeBg: '#b45309',
          badgeText: '#ffffff',
          avatarRing: '#d97706',
        },
      ];

      for (let i = 0; i < 3; i++) {
        const student = topStudents[i] || null;
        const config = rankConfigs[i];
        const cardY = cardsStartY + i * (cardHeight + cardGap);
        const cardX = 70;

        // Card Container
        ctx.fillStyle = config.cardBg;
        drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 28);
        ctx.fill();

        ctx.strokeStyle = config.borderColor;
        ctx.lineWidth = i === 0 ? 2.5 : 1.5;
        ctx.stroke();

        // Inner subtle glow for Rank 1
        if (i === 0) {
          const rankGlow = ctx.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY + cardHeight);
          rankGlow.addColorStop(0, 'rgba(245, 158, 11, 0.08)');
          rankGlow.addColorStop(1, 'rgba(245, 158, 11, 0.01)');
          ctx.fillStyle = rankGlow;
          drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 28);
          ctx.fill();
        }

        if (student) {
          // --- Left: Large Profile Picture with Glowing Ring ---
          const avatarSize = 136;
          const avatarX = cardX + 32;
          const avatarY = cardY + (cardHeight - avatarSize) / 2;

          // Glowing Outer Avatar Ring
          ctx.beginPath();
          ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
          ctx.strokeStyle = config.avatarRing;
          ctx.lineWidth = 4;
          ctx.stroke();

          // Clip Avatar Image inside Circle
          ctx.save();
          ctx.beginPath();
          ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();

          const loadedImg = avatarImages[i];
          if (loadedImg) {
            ctx.drawImage(loadedImg, avatarX, avatarY, avatarSize, avatarSize);
          } else {
            // High-aesthetic monogram gradient fallback
            const monoGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
            monoGrad.addColorStop(0, '#4338ca');
            monoGrad.addColorStop(1, '#6366f1');
            ctx.fillStyle = monoGrad;
            ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);

            ctx.fillStyle = '#ffffff';
            ctx.font = '800 52px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const initials = (student.full_name || 'U').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
            ctx.fillText(initials, avatarX + avatarSize / 2, avatarY + avatarSize / 2);
          }
          ctx.restore();

          // Rank Ribbon Pill on top of avatar
          const rankPillText = `#${i + 1}`;
          ctx.font = '900 16px system-ui, -apple-system, sans-serif';
          const rPillW = 44;
          const rPillH = 26;
          const rPillX = avatarX + avatarSize - 32;
          const rPillY = avatarY + avatarSize - 22;

          ctx.fillStyle = config.badgeBg;
          drawRoundedRect(ctx, rPillX, rPillY, rPillW, rPillH, 13);
          ctx.fill();
          ctx.fillStyle = config.badgeText;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(rankPillText, rPillX + rPillW / 2, rPillY + rPillH / 2);

          // --- Middle: Student Name and Title ---
          const infoX = avatarX + avatarSize + 36;
          const infoY = cardY + 42;

          // Rank Title (e.g. 🥇 FIRST PLACE • CHAMPION)
          ctx.fillStyle = config.color;
          ctx.font = '800 14px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(config.title, infoX, infoY);

          // Student Full Name
          ctx.fillStyle = '#ffffff';
          ctx.font = '900 32px system-ui, -apple-system, sans-serif';
          const maxNameWidth = 440;
          let displayName = student.full_name || 'Member';
          if (ctx.measureText(displayName).width > maxNameWidth) {
            while (ctx.measureText(displayName + '...').width > maxNameWidth && displayName.length > 5) {
              displayName = displayName.slice(0, -1);
            }
            displayName += '...';
          }
          ctx.fillText(displayName, infoX, infoY + 28);

          // Verified One-to-One Student Badge
          ctx.fillStyle = '#34d399';
          ctx.font = '600 15px system-ui, -apple-system, sans-serif';
          ctx.fillText('✓ Verified Community Member • 1-on-1 Practice', infoX, infoY + 74);

          // --- Right: Speaking Practice Duration Box ---
          const statBoxW = 220;
          const statBoxH = 120;
          const statBoxX = cardX + cardWidth - statBoxW - 32;
          const statBoxY = cardY + (cardHeight - statBoxH) / 2;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          drawRoundedRect(ctx, statBoxX, statBoxY, statBoxW, statBoxH, 20);
          ctx.fill();
          ctx.strokeStyle = config.borderColor;
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.fillStyle = '#94a3b8';
          ctx.font = '700 12px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText('PRACTICE TIME', statBoxX + statBoxW / 2, statBoxY + 18);

          // Formatted duration: e.g. "2h 45m" or "48m"
          const formattedDuration = formatSpeakingDuration(student.speaking_seconds);
          ctx.fillStyle = config.color;
          ctx.font = '900 36px system-ui, -apple-system, sans-serif';
          ctx.fillText(formattedDuration, statBoxX + statBoxW / 2, statBoxY + 40);

          ctx.fillStyle = '#64748b';
          ctx.font = '600 13px system-ui, -apple-system, sans-serif';
          ctx.fillText('Pure Speaking Time', statBoxX + statBoxW / 2, statBoxY + 84);

        } else {
          // Empty slot placeholder
          ctx.fillStyle = '#64748b';
          ctx.font = '700 20px system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`Position #${i + 1} Open — Practice today to claim this rank!`, cardX + cardWidth / 2, cardY + cardHeight / 2);
        }
      }

      // --- 6. Promotional Footer: SayBD Brand Invitation ---
      const promoBoxY = 1075;
      const promoBoxHeight = 195;
      const promoBoxWidth = width - 140;

      const promoGrad = ctx.createLinearGradient(70, promoBoxY, 70 + promoBoxWidth, promoBoxY + promoBoxHeight);
      promoGrad.addColorStop(0, 'rgba(49, 46, 129, 0.7)');
      promoGrad.addColorStop(0.5, 'rgba(30, 27, 75, 0.85)');
      promoGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
      ctx.fillStyle = promoGrad;
      drawRoundedRect(ctx, 70, promoBoxY, promoBoxWidth, promoBoxHeight, 26);
      ctx.fill();
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Promotional Headline
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 28px system-ui, -apple-system, sans-serif';
      ctx.fillText('Join SayBD and improve your English speaking skills!', 105, promoBoxY + 28);

      // Supporting copy
      ctx.fillStyle = '#c7d2fe';
      ctx.font = '500 17px system-ui, -apple-system, sans-serif';
      ctx.fillText('Free daily 1-on-1 partner matching • Live mentor masterclasses • Interactive courses', 105, promoBoxY + 70);

      // App URL CTA Button
      const joinBtnY = promoBoxY + 110;
      const joinBtnHeight = 52;
      const joinBtnWidth = 460;
      ctx.fillStyle = '#6366f1';
      drawRoundedRect(ctx, 105, joinBtnY, joinBtnWidth, joinBtnHeight, 16);
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 19px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Practice now: ${cleanUrl}`, 105 + joinBtnWidth / 2, joinBtnY + joinBtnHeight / 2);

      // Right-side brand seal
      ctx.textAlign = 'right';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 14px system-ui, -apple-system, sans-serif';
      ctx.fillText('100% Real Conversations • Verified Audio/Video Calls', width - 105, promoBoxY + 136);

      // --- 7. Export as Data URL & Blob ---
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to generate image blob'));
          return;
        }
        const dataUrl = canvas.toDataURL('image/png');
        resolve({
          dataUrl,
          blob,
          filename: `saybd-top3-leaderboard-${period}.png`,
          width,
          height,
        });
      }, 'image/png');

    } catch (err) {
      reject(err);
    }
  });
}
