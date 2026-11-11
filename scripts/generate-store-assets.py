#!/usr/bin/env python3
"""
Generate complete Chrome Web Store graphic assets for Max Subtitles:
- Store Icon (128x128 PNG)
- Screenshot 1: Player & Subtitle Overlay (1280x800 24-bit PNG, no alpha)
- Screenshot 2: Toolbar Popup Settings & Customization (1280x800 24-bit PNG, no alpha)
- Small Promo Tile (440x280 24-bit PNG, no alpha)
- Marquee Promo Tile (1400x560 24-bit PNG, no alpha)
"""

import os
from PIL import Image, ImageDraw, ImageFont

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT_DIR, 'store-assets')
os.makedirs(OUT_DIR, exist_ok=True)

# Fonts
FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_REGULAR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

def get_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

def draw_gradient_rect(draw, bbox, start_color, end_color):
    x0, y0, x1, y1 = bbox
    height = y1 - y0
    for y in range(height):
        ratio = y / max(1, height)
        r = int(start_color[0] + (end_color[0] - start_color[0]) * ratio)
        g = int(start_color[1] + (end_color[1] - start_color[1]) * ratio)
        b = int(start_color[2] + (end_color[2] - start_color[2]) * ratio)
        draw.line([(x0, y0 + y), (x1, y0 + y)], fill=(r, g, b))

# -------------------------------------------------------------
# 1. Store Icon (128x128 PNG)
# -------------------------------------------------------------
def make_store_icon():
    img = Image.new('RGB', (128, 128), (14, 17, 23))
    draw = ImageDraw.Draw(img)

    # Rounded gradient icon badge
    draw.rounded_rectangle([10, 10, 118, 118], radius=24, fill=(30, 38, 56), outline=(99, 102, 241), width=2)
    draw.rounded_rectangle([18, 18, 110, 110], radius=18, fill=(18, 22, 34))

    # Subtitle bars visual
    draw.rounded_rectangle([32, 42, 96, 52], radius=4, fill=(99, 102, 241))
    draw.rounded_rectangle([40, 58, 88, 68], radius=4, fill=(244, 244, 245))
    draw.rounded_rectangle([34, 74, 94, 84], radius=4, fill=(165, 180, 252))

    path = os.path.join(OUT_DIR, 'store-icon-128.png')
    img.save(path, 'PNG')
    # Also copy to icons/icon128.png
    img.save(os.path.join(ROOT_DIR, 'icons', 'icon128.png'), 'PNG')
    print(f"Generated: {path}")

# -------------------------------------------------------------
# 2. Screenshot 1: In-Player Subtitle Overlay (1280x800)
# -------------------------------------------------------------
def make_screenshot_player():
    img = Image.new('RGB', (1280, 800), (10, 12, 18))
    draw = ImageDraw.Draw(img)

    # Header / Title banner
    draw_gradient_rect(draw, [0, 0, 1280, 90], (17, 24, 39), (10, 12, 18))
    title_font = get_font(FONT_BOLD, 30)
    sub_font = get_font(FONT_REGULAR, 18)
    draw.text((60, 24), "Max Subtitles", font=title_font, fill=(255, 255, 255))
    draw.text((290, 32), "•  Clean, High-Contrast Subtitle Overlay for HBO Max", font=sub_font, fill=(165, 180, 252))

    # Simulated cinematic video frame
    draw.rounded_rectangle([60, 110, 1220, 720], radius=16, fill=(18, 20, 28), outline=(55, 65, 81), width=2)
    # Background movie scene lighting effect
    draw_gradient_rect(draw, [62, 112, 1218, 718], (24, 30, 48), (12, 14, 20))

    # Center episode title watermark (like Friends / Những Người Bạn)
    ep_font = get_font(FONT_REGULAR, 22)
    draw.text((90, 140), "Những Người Bạn — Season 1 Episode 1", font=ep_font, fill=(156, 163, 175))

    # Subtitle overlay box in the lower-third of the player
    sub_bg = (0, 0, 0)
    sub_text1 = "Đúng, bạn không phải"
    sub_text2 = "thậm chí nhận được tuần trăng mật của bạn."
    sub_draw_font = get_font(FONT_BOLD, 28)

    # Box 1
    bbox1 = draw.textbbox((0, 0), sub_text1, font=sub_draw_font)
    w1, h1 = bbox1[2] - bbox1[0], bbox1[3] - bbox1[1]
    x1 = (1280 - w1) // 2
    draw.rounded_rectangle([x1 - 18, 510, x1 + w1 + 18, 510 + h1 + 16], radius=6, fill=sub_bg, outline=(75, 85, 99), width=1)
    draw.text((x1, 514), sub_text1, font=sub_draw_font, fill=(255, 255, 255))

    # Box 2
    bbox2 = draw.textbbox((0, 0), sub_text2, font=sub_draw_font)
    w2, h2 = bbox2[2] - bbox2[0], bbox2[3] - bbox2[1]
    x2 = (1280 - w2) // 2
    draw.rounded_rectangle([x2 - 18, 560, x2 + w2 + 18, 560 + h2 + 16], radius=6, fill=sub_bg, outline=(75, 85, 99), width=1)
    draw.text((x2, 564), sub_text2, font=sub_draw_font, fill=(255, 255, 255))

    # Player scrubber bar
    draw.rounded_rectangle([90, 675, 1190, 681], radius=3, fill=(75, 85, 99))
    draw.rounded_rectangle([90, 675, 520, 681], radius=3, fill=(99, 102, 241))
    draw.ellipse([515, 673, 527, 683], fill=(255, 255, 255))
    time_font = get_font(FONT_REGULAR, 15)
    draw.text((90, 690), "08:42", font=time_font, fill=(209, 213, 219))
    draw.text((1150, 690), "-13:52", font=time_font, fill=(209, 213, 219))

    # Feature tag in top right
    draw.rounded_rectangle([940, 135, 1190, 175], radius=8, fill=(99, 102, 241))
    tag_font = get_font(FONT_BOLD, 14)
    draw.text((955, 145), "✓ Pure Subtitle (No Dual Cues)", font=tag_font, fill=(255, 255, 255))

    path = os.path.join(OUT_DIR, 'screenshot1-player.png')
    img.save(path, 'PNG')
    print(f"Generated: {path}")

# -------------------------------------------------------------
# 3. Screenshot 2: Toolbar Popup UI & Settings (1280x800)
# -------------------------------------------------------------
def make_screenshot_popup():
    img = Image.new('RGB', (1280, 800), (12, 15, 24))
    draw = ImageDraw.Draw(img)

    # Header
    draw_gradient_rect(draw, [0, 0, 1280, 90], (17, 24, 39), (12, 15, 24))
    title_font = get_font(FONT_BOLD, 30)
    sub_font = get_font(FONT_REGULAR, 18)
    draw.text((60, 24), "Max Subtitles", font=title_font, fill=(255, 255, 255))
    draw.text((290, 32), "•  Instant Controls & Font Scaling", font=sub_font, fill=(165, 180, 252))

    # Background ambient display
    draw.rounded_rectangle([60, 120, 720, 720], radius=16, fill=(18, 22, 34), outline=(55, 65, 81), width=1)
    card_h_font = get_font(FONT_BOLD, 22)
    card_p_font = get_font(FONT_REGULAR, 16)
    draw.text((90, 160), "Key Capabilities", font=card_h_font, fill=(255, 255, 255))
    bullets = [
        "• Automatic English caption hook in 1-2 seconds",
        "• Pure custom subtitles with zero dual-caption clutter",
        "• Mid-video horizon pre-fetching prevents cutoffs",
        "• Fullscreen-aware positioning dynamically binds to video",
        "• 0ms instant playback for rewound scenes via local cache"
    ]
    for i, b in enumerate(bullets):
        draw.text((90, 220 + i * 50), b, font=card_p_font, fill=(209, 213, 219))

    # Render Chrome Extension Popup UI on right side
    px, py, pw, ph = 780, 140, 420, 560
    draw.rounded_rectangle([px, py, px + pw, py + ph], radius=16, fill=(24, 28, 42), outline=(99, 102, 241), width=2)

    # Popup Header
    draw.rounded_rectangle([px + 20, py + 20, px + 64, py + 64], radius=10, fill=(99, 102, 241))
    draw.text((px + 34, py + 28), "S", font=get_font(FONT_BOLD, 26), fill=(255, 255, 255))
    draw.text((px + 80, py + 24), "Max Subtitles", font=get_font(FONT_BOLD, 20), fill=(255, 255, 255))
    draw.rounded_rectangle([px + 80, py + 50, px + 155, py + 68], radius=4, fill=(55, 65, 81))
    draw.text((px + 86, py + 52), "HBO MAX", font=get_font(FONT_BOLD, 11), fill=(165, 180, 252))

    # Toggle row
    draw.rounded_rectangle([px + 20, py + 95, px + pw - 20, py + 165], radius=10, fill=(30, 36, 54))
    draw.text((px + 36, py + 112), "Subtitles Enabled", font=get_font(FONT_BOLD, 16), fill=(255, 255, 255))
    draw.text((px + 36, py + 136), "Auto-hook and translate cues", font=get_font(FONT_REGULAR, 13), fill=(156, 163, 175))
    # Active switch
    draw.rounded_rectangle([px + pw - 75, py + 118, px + pw - 35, py + 142], radius=12, fill=(99, 102, 241))
    draw.ellipse([px + pw - 53, py + 120, px + pw - 37, py + 140], fill=(255, 255, 255))

    # Font size slider section
    draw.text((px + 24, py + 190), "Font Size: 24px", font=get_font(FONT_BOLD, 16), fill=(255, 255, 255))
    draw.rounded_rectangle([px + 24, py + 225, px + pw - 24, py + 233], radius=4, fill=(55, 65, 81))
    draw.rounded_rectangle([px + 24, py + 225, px + 210, py + 233], radius=4, fill=(99, 102, 241))
    draw.ellipse([px + 202, py + 221, px + 218, py + 237], fill=(255, 255, 255))

    # Presets
    presets = [("Small", 18), ("Medium", 24), ("Large", 32), ("X-Large", 40)]
    bx = px + 24
    for name, sz in presets:
        is_active = (sz == 24)
        bg = (99, 102, 241) if is_active else (38, 45, 66)
        fg = (255, 255, 255) if is_active else (209, 213, 219)
        draw.rounded_rectangle([bx, py + 260, bx + 84, py + 296], radius=6, fill=bg)
        draw.text((bx + 16, py + 270), name, font=get_font(FONT_BOLD if is_active else FONT_REGULAR, 13), fill=fg)
        bx += 94

    # Preview Card
    draw.rounded_rectangle([px + 20, py + 325, px + pw - 20, py + 480], radius=10, fill=(18, 20, 30))
    draw.text((px + 34, py + 340), "PREVIEW", font=get_font(FONT_BOLD, 12), fill=(156, 163, 175))
    draw.rounded_rectangle([px + 36, py + 380, px + pw - 36, py + 440], radius=6, fill=(0, 0, 0), outline=(55, 65, 81), width=1)
    draw.text((px + 54, py + 398), "Xin chào! Đây là phụ đề mẫu.", font=get_font(FONT_BOLD, 18), fill=(255, 255, 255))

    path = os.path.join(OUT_DIR, 'screenshot2-popup.png')
    img.save(path, 'PNG')
    print(f"Generated: {path}")

# -------------------------------------------------------------
# 4. Small Promo Tile (440x280)
# -------------------------------------------------------------
def make_small_promo():
    img = Image.new('RGB', (440, 280), (14, 18, 28))
    draw = ImageDraw.Draw(img)
    draw_gradient_rect(draw, [0, 0, 440, 280], (26, 32, 54), (10, 12, 20))

    # Icon
    draw.rounded_rectangle([32, 36, 88, 92], radius=14, fill=(99, 102, 241))
    draw.text((50, 48), "S", font=get_font(FONT_BOLD, 36), fill=(255, 255, 255))

    # Badge
    draw.rounded_rectangle([104, 38, 180, 58], radius=4, fill=(45, 55, 78))
    draw.text((112, 42), "HBO MAX", font=get_font(FONT_BOLD, 12), fill=(165, 180, 252))

    # Titles
    draw.text((104, 68), "Max Subtitles", font=get_font(FONT_BOLD, 24), fill=(255, 255, 255))
    draw.text((32, 118), "Clean, Pure Subtitles for HBO Max", font=get_font(FONT_BOLD, 16), fill=(229, 231, 235))

    # Subtitle preview box
    draw.rounded_rectangle([32, 160, 408, 220], radius=8, fill=(0, 0, 0), outline=(75, 85, 99), width=1)
    draw.text((56, 178), "Phụ đề chuẩn xác • Không che hình", font=get_font(FONT_BOLD, 17), fill=(255, 255, 255))

    # Tag line
    draw.text((32, 242), "Instant 0ms Cache  •  Fullscreen Ready", font=get_font(FONT_REGULAR, 13), fill=(156, 163, 175))

    path = os.path.join(OUT_DIR, 'small-promo-440x280.png')
    img.save(path, 'PNG')
    print(f"Generated: {path}")

# -------------------------------------------------------------
# 5. Marquee Promo Tile (1400x560)
# -------------------------------------------------------------
def make_marquee_promo():
    img = Image.new('RGB', (1400, 560), (12, 15, 24))
    draw = ImageDraw.Draw(img)
    draw_gradient_rect(draw, [0, 0, 1400, 560], (30, 36, 62), (10, 12, 18))

    # Left Column: Branding & Feature List
    draw.rounded_rectangle([90, 80, 164, 154], radius=18, fill=(99, 102, 241))
    draw.text((112, 94), "S", font=get_font(FONT_BOLD, 52), fill=(255, 255, 255))

    draw.rounded_rectangle([184, 86, 280, 114], radius=6, fill=(45, 55, 82))
    draw.text((196, 92), "HBO MAX", font=get_font(FONT_BOLD, 16), fill=(165, 180, 252))

    draw.text((184, 124), "Max Subtitles", font=get_font(FONT_BOLD, 42), fill=(255, 255, 255))
    draw.text((90, 180), "Pure, customizable subtitles and live translation for movies & series", font=get_font(FONT_REGULAR, 22), fill=(209, 213, 219))

    features = [
        "✓ 1-2s Automatic Background Hook & Turn-Off",
        "✓ Pure Display with Zero Dual-Caption Overlap",
        "✓ Mid-Video Horizon Pre-Fetching (No Cutoffs)",
        "✓ High-Performance 0ms Local Memory Cache",
        "✓ Dynamic Fullscreen & Player Control Alignment"
    ]
    for i, feat in enumerate(features):
        draw.text((90, 245 + i * 44), feat, font=get_font(FONT_BOLD, 18), fill=(165, 180, 252))

    # Right Column: Big Preview Player Card
    rx, ry, rw, rh = 760, 90, 550, 380
    draw.rounded_rectangle([rx, ry, rx + rw, ry + rh], radius=16, fill=(18, 22, 34), outline=(75, 85, 99), width=2)
    draw_gradient_rect(draw, [rx + 2, ry + 2, rx + rw - 2, ry + rh - 2], (24, 30, 48), (12, 14, 22))

    # Dialogue in player card
    draw.rounded_rectangle([rx + 40, ry + 200, rx + rw - 40, ry + 265], radius=8, fill=(0, 0, 0), outline=(99, 102, 241), width=1)
    draw.text((rx + 60, ry + 220), "Xin chào! Phụ đề luôn chuẩn và rõ nét.", font=get_font(FONT_BOLD, 22), fill=(255, 255, 255))

    # Scrubber in player card
    draw.rounded_rectangle([rx + 40, ry + 310, rx + rw - 40, ry + 316], radius=3, fill=(75, 85, 99))
    draw.rounded_rectangle([rx + 40, ry + 310, rx + 260, ry + 316], radius=3, fill=(99, 102, 241))
    draw.ellipse([rx + 254, ry + 308, rx + 266, ry + 318], fill=(255, 255, 255))

    path = os.path.join(OUT_DIR, 'marquee-promo-1400x560.png')
    img.save(path, 'PNG')
    print(f"Generated: {path}")

if __name__ == '__main__':
    make_store_icon()
    make_screenshot_player()
    make_screenshot_popup()
    make_small_promo()
    make_marquee_promo()
    print("All graphic assets successfully created in store-assets/!")
