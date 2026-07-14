import asyncio
import sys
import edge_tts

if len(sys.argv) < 3:
    raise ValueError("Text aur output path required hain.")

TEXT = sys.argv[1].strip()
OUTPUT = sys.argv[2]

VOICE = "hi-IN-MadhurNeural"
RATE = "-5%"
PITCH = "-2Hz"
VOLUME = "+0%"

if not TEXT:
    raise ValueError("Voice generation ke liye text empty hai.")

async def main():
    communicate = edge_tts.Communicate(
        text=TEXT,
        voice=VOICE,
        rate=RATE,
        pitch=PITCH,
        volume=VOLUME,
    )

    await communicate.save(OUTPUT)

asyncio.run(main())