"""Generate the scannable, non-payment QR used by the Kopi Sore demo."""

from pathlib import Path
import sys


def gf_mul(x: int, y: int) -> int:
    result = 0
    while y:
        if y & 1:
            result ^= x
        y >>= 1
        x <<= 1
        if x & 0x100:
            x ^= 0x11D
    return result


def rs_divisor(degree: int) -> list[int]:
    result = [0] * (degree - 1) + [1]
    root = 1
    for _ in range(degree):
        for i in range(degree):
            result[i] = gf_mul(result[i], root)
            if i + 1 < degree:
                result[i] ^= result[i + 1]
        root = gf_mul(root, 2)
    return result


def rs_remainder(data: list[int], divisor: list[int]) -> list[int]:
    result = [0] * len(divisor)
    for byte in data:
        factor = byte ^ result[0]
        result = result[1:] + [0]
        for i, coefficient in enumerate(divisor):
            result[i] ^= gf_mul(coefficient, factor)
    return result


def make_qr(payload: bytes) -> list[list[bool]]:
    # Version 3-L: 29x29 modules, one 55-byte data block and 15 ECC bytes.
    size, data_words, ecc_words = 29, 55, 15
    bits: list[int] = []

    def append_bits(value: int, width: int) -> None:
        bits.extend((value >> i) & 1 for i in reversed(range(width)))

    append_bits(0b0100, 4)  # Byte mode
    append_bits(len(payload), 8)
    for byte in payload:
        append_bits(byte, 8)
    bits.extend([0] * min(4, data_words * 8 - len(bits)))
    bits.extend([0] * ((-len(bits)) % 8))
    data = [sum(bits[i + j] << (7 - j) for j in range(8)) for i in range(0, len(bits), 8)]
    pads = [0xEC, 0x11]
    while len(data) < data_words:
        data.append(pads[(len(data) - ((len(bits) + 7) // 8)) % 2])
    codewords = data + rs_remainder(data, rs_divisor(ecc_words))

    matrix = [[False] * size for _ in range(size)]
    function = [[False] * size for _ in range(size)]

    def set_function(row: int, col: int, dark: bool) -> None:
        if 0 <= row < size and 0 <= col < size:
            matrix[row][col] = dark
            function[row][col] = True

    def finder(center_row: int, center_col: int) -> None:
        for dy in range(-4, 5):
            for dx in range(-4, 5):
                row, col = center_row + dy, center_col + dx
                distance = max(abs(dx), abs(dy))
                set_function(row, col, distance != 2 and distance != 4)

    finder(3, 3)
    finder(3, size - 4)
    finder(size - 4, 3)

    for i in range(8, size - 8):
        set_function(6, i, i % 2 == 0)
        set_function(i, 6, i % 2 == 0)

    # The only version-3 alignment target not covered by a finder pattern.
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            set_function(size - 7 + dy, size - 7 + dx, max(abs(dx), abs(dy)) != 1)

    # Reserve both format-information areas and the fixed dark module.
    for i in range(6):
        set_function(i, 8, False)
    set_function(7, 8, False)
    set_function(8, 8, False)
    set_function(8, 7, False)
    for i in range(9, 15):
        set_function(8, 14 - i, False)
    for i in range(8):
        set_function(8, size - 1 - i, False)
    for i in range(8, 15):
        set_function(size - 15 + i, 8, False)
    set_function(size - 8, 8, True)

    stream = [((word >> i) & 1) != 0 for word in codewords for i in reversed(range(8))]
    bit_index = 0
    upward = True
    right = size - 1
    while right >= 1:
        if right == 6:
            right = 5
        for vert in range(size):
            row = size - 1 - vert if upward else vert
            for offset in range(2):
                col = right - offset
                if not function[row][col]:
                    dark = stream[bit_index] if bit_index < len(stream) else False
                    bit_index += 1
                    # Mask pattern 0.
                    matrix[row][col] = dark ^ ((row + col) % 2 == 0)
        upward = not upward
        right -= 2

    # Error-correction level L (01), mask pattern 0, BCH protected.
    format_data = (0b01 << 3) | 0
    remainder = format_data << 10
    for i in reversed(range(10, 15)):
        if (remainder >> i) & 1:
            remainder ^= 0x537 << (i - 10)
    format_bits = ((format_data << 10) | remainder) ^ 0x5412

    def set_format(row: int, col: int, bit: int) -> None:
        matrix[row][col] = ((format_bits >> bit) & 1) != 0

    for i in range(6):
        set_format(i, 8, i)
    set_format(7, 8, 6)
    set_format(8, 8, 7)
    set_format(8, 7, 8)
    for i in range(9, 15):
        set_format(8, 14 - i, i)
    for i in range(8):
        set_format(8, size - 1 - i, i)
    for i in range(8, 15):
        set_format(size - 15 + i, 8, i)
    matrix[size - 8][8] = True
    return matrix


def main() -> None:
    public_url = sys.argv[1] if len(sys.argv) > 1 else None
    payload = (public_url.encode("utf-8") if public_url else
               b"KOPI SORE WEB3 DEMO PAYMENT - NO REAL FUNDS")
    if len(payload) > 53:
        raise SystemExit("QR Version 3-L hanya mendukung maksimal 53 byte.")
    matrix = make_qr(payload)
    quiet = 4
    size = len(matrix) + quiet * 2
    modules = "".join(
        f'<rect x="{col + quiet}" y="{row + quiet}" width="1" height="1"/>'
        for row in range(len(matrix))
        for col in range(len(matrix))
        if matrix[row][col]
    )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
        'shape-rendering="crispEdges" role="img" aria-label="Demo QR pembayaran Kopi Sore, tidak menerima dana">'
        f'<rect width="{size}" height="{size}" fill="#fff"/>'
        f'<g fill="#080b12">{modules}</g>'
        '</svg>'
    )
    output_name = "site-access.svg" if public_url else "demo-payment.svg"
    output = Path(__file__).parent / "images" / output_name
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(svg, encoding="utf-8")
    print(f"Created {output}")


if __name__ == "__main__":
    main()
