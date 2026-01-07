const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let image1 = new Image();
const fileInput = document.querySelector('#image-file');
const fileName = document.getElementById('fileName');
const inputSlider = document.getElementById('resolution');
const inputLabel = document.getElementById('resolutionLabel');
const brightness = document.getElementById('brightness');
const brightnessLabel = document.getElementById('brightnessLabel');
const contrast = document.getElementById('contrast');
const contrastLabel = document.getElementById('contrastLabel');
const invert = document.getElementById('invert');
const mono = document.getElementById('mono');
const asciiTextEl = document.getElementById('asciiText');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');

let effect;

let debounceTimeout;

function queueRender() {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(render, 60);
}

inputSlider?.addEventListener('input', queueRender);
brightness?.addEventListener('input', () => {
    brightnessLabel.textContent = `Brightness: ${brightness.value}`;
    queueRender();
});
contrast?.addEventListener('input', () => {
    contrastLabel.textContent = `Contrast: ${Number(contrast.value).toFixed(1)}`;
    queueRender();
});
invert?.addEventListener('change', queueRender);
mono?.addEventListener('change', queueRender);

copyBtn?.addEventListener('click', async () => {
    if (!effect) return;
    const text = effect.getAsciiText();
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => (copyBtn.textContent = 'Copy Text'), 1000);
    } catch (e) {
        console.error('Copy failed', e);
    }
});

downloadBtn?.addEventListener('click', () => {
    if (!effect) return;
    const text = effect.getAsciiText();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ascii-art.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
});

clearBtn?.addEventListener('click', () => {
    asciiTextEl.textContent = '';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fileInput.value = '';
    fileName.textContent = 'No file selected';
    image1 = new Image();
    effect = undefined;
});

// File upload handling
fileInput?.addEventListener('change', function () {
    const file = this.files?.[0];
    if (!file) return;
    fileName.textContent = file.name;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
        image1 = new Image();
        image1.src = reader.result;
        image1.onload = initialize;
    });
    reader.readAsDataURL(file);
});

class Cell {
    constructor(x, y, symbol, color){
        this.x = x;
        this.y = y;
        this.symbol = symbol;
        this.color = color;
    }
    draw(ctx, monochrome = false){
        ctx.fillStyle = monochrome ? '#fff' : this.color;
        ctx.fillText(this.symbol, this.x, this.y);
    }
}

class AsciiEffect {
    #imageCellArray = [];
    #pixels = [];
    #ctx;
    #width;
    #height;

    constructor(ctx, width, height){
        this.#ctx = ctx;
        this.#width = width;
        this.#height = height;
        this.updatePixels();
        this._asciiRows = [];
    }

    updatePixels(){
        this.#ctx.drawImage(image1, 0, 0, this.#width, this.#height);
        this.#pixels = this.#ctx.getImageData(0, 0, this.#width, this.#height);
    }

    #convertToSymbol(g){
        // From light to dark. Adjust to taste.
        const symbols = ' .,:;clodxkO0KXNW';
        const index = Math.floor((g / 255) * (symbols.length - 1));
        return symbols[index] ?? ' ';
    }

    #scanImage(cellSize, brightnessAdj = 0, contrastAdj = 1, invert = false, monochrome = false) {
        this.#imageCellArray = [];
        this._asciiRows = [];
        for (let y = 0; y < this.#pixels.height; y += cellSize){
            let row = '';
            for (let x = 0; x < this.#pixels.width; x += cellSize){
                const pos = ((y * this.#pixels.width) + x) * 4;
                if (this.#pixels.data[pos + 3] > 64){
                    const red = this.#pixels.data[pos];
                    const green = this.#pixels.data[pos + 1];
                    const blue = this.#pixels.data[pos + 2];

                    let avg = (red + green + blue) / 3;
                    avg = (avg - 128) * contrastAdj + 128 + brightnessAdj;
                    avg = Math.min(255, Math.max(0, avg));
                    if (invert) avg = 255 - avg;

                    const color = `rgb(${red},${green},${blue})`;
                    const symbol = this.#convertToSymbol(avg);
                    row += symbol;
                    if (symbol.trim()) this.#imageCellArray.push(new Cell(x, y, symbol, color));
                } else {
                    row += ' ';
                }
            }
            this._asciiRows.push(row);
        }
    }

    #drawAscii(monochrome = false){
        this.#ctx.clearRect(0, 0, this.#width, this.#height);
        for (let cell of this.#imageCellArray){
            cell.draw(this.#ctx, monochrome);
        }
    }

    draw(cellSize, brightnessAdj = 0, contrastAdj = 1, invert = false, monochrome = false) {
        this.updatePixels();
        this.#scanImage(cellSize, brightnessAdj, contrastAdj, invert, monochrome);
        this.#drawAscii(monochrome);
    }

    getAsciiText() {
        return this._asciiRows?.join('\n') ?? '';
    }
}

function render() {
    if (!effect) return;
    const resolution = parseInt(inputSlider.value);
    inputLabel.textContent = `Cell Size: ${resolution}px`;
    const b = parseInt(brightness.value);
    const c = parseFloat(contrast.value);
    const inv = invert.checked;
    const m = mono.checked;

    ctx.font = `${resolution * 2}px monospace`;
    effect.draw(resolution, b, c, inv, m);
    asciiTextEl.textContent = effect.getAsciiText();
}

function initialize() {
    // Fit image into a max bounding box while preserving aspect ratio
    const maxW = 1000;
    const maxH = 700;
    let { width, height } = image1;
    const scale = Math.min(maxW / width, maxH / height, 1);
    width = Math.floor(width * scale);
    height = Math.floor(height * scale);

    canvas.width = width;
    canvas.height = height;
    effect = new AsciiEffect(ctx, width, height);
    render();
}
