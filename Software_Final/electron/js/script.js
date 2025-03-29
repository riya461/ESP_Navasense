// DOM Elements
const editor = document.getElementById("editor");
const status = document.getElementById("status");
const statusText = document.getElementById("status-text");
const statusIcon = document.getElementById("status-icon");
const suggestionBox = document.getElementById("suggestion");
const drawingPad = document.getElementById("drawing-pad");
const clearDrawingBtn = document.getElementById("clear-drawing");
const sendDrawingBtn = document.getElementById("send-drawing");

// State
let lastProcessedWord = "";
let isProcessing = false;
let currentSelection = null;
let isDrawing = false;
let currentWordBuffer = "";


// Initialize Drawing Pad
const ctx = drawingPad.getContext("2d");
ctx.strokeStyle = "#000000";
ctx.lineWidth = 8;
ctx.lineCap = "round";
ctx.lineJoin = "round";

// Event Listeners
editor.addEventListener("input", handleInput);
editor.addEventListener("keydown", handleKeyDown);
editor.addEventListener("click", hideSuggestion);
document.addEventListener("click", (e) => {
  if (!suggestionBox.contains(e.target)) {
    hideSuggestion();
  }
});

// Drawing Pad Events
drawingPad.addEventListener("mousedown", startDrawing);
drawingPad.addEventListener("mousemove", draw);
drawingPad.addEventListener("mouseup", stopDrawing);
drawingPad.addEventListener("mouseout", stopDrawing);

// Touch support for drawing
drawingPad.addEventListener("touchstart", handleTouchStart);
drawingPad.addEventListener("touchmove", handleTouchMove);
drawingPad.addEventListener("touchend", stopDrawing);

clearDrawingBtn.addEventListener("click", clearDrawing);
sendDrawingBtn.addEventListener("click", sendDrawingToServer);

// Writing Pad Event Listeners
document.querySelectorAll(".pad-button, .dropdown-item").forEach((button) => {
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    const command = button.dataset.command;

    if (command === "undo" || command === "redo") {
      document.execCommand(command, false, null);
      return;
    }

    if (["bold", "italic", "underline"].includes(command)) {
      button.classList.toggle("active");
    }

    document.execCommand(command, false, null);
    editor.focus();
  });
});

// Update button states based on current selection
editor.addEventListener("keyup", updateButtonStates);
editor.addEventListener("mouseup", updateButtonStates);

// Drawing Functions
function startDrawing(e) {
  isDrawing = true;
  draw(e);
}

function draw(e) {
  if (!isDrawing) return;

  const rect = drawingPad.getBoundingClientRect();
  let x, y;

  if (e.type.includes("touch")) {
    x = e.touches[0].clientX - rect.left;
    y = e.touches[0].clientY - rect.top;
  } else {
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
  }

  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
}

function handleTouchStart(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent("mousedown", {
    clientX: touch.clientX,
    clientY: touch.clientY,
  });
  drawingPad.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent("mousemove", {
    clientX: touch.clientX,
    clientY: touch.clientY,
  });
  drawingPad.dispatchEvent(mouseEvent);
}

function stopDrawing() {
  isDrawing = false;
  ctx.beginPath();
}

function clearDrawing() {
  ctx.clearRect(0, 0, drawingPad.width, drawingPad.height);
}

async function sendDrawingToServer() {
  try {
    if (isCanvasBlank(drawingPad)) {
      updateStatus("Please draw something first", false, "error");
      setTimeout(() => updateStatus("Ready", false), 2000);
      return;
    }

    updateStatus("Processing drawing...", true);

    // Convert canvas to blob
    drawingPad.toBlob(async (blob) => {
      const formData = new FormData();
      formData.append("drawing", blob, "drawing.png");

      const response = await fetch("http://127.0.0.1:5000/predict", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      editor.textContent += data.character;

      updateStatus(
        `Inserted: ${data.character} (${(data.confidence * 100).toFixed(
          1
        )}% confidence)`,
        false,
        "success"
      );
      clearDrawing();
    }, "image/png");
  } catch (error) {
    console.error("Prediction error:", error);
    updateStatus(error.message, false, "error");
    setTimeout(() => updateStatus("Ready", false), 3000);
  }
}

function isCanvasBlank(canvas) {
  const context = canvas.getContext("2d");
  const pixelBuffer = new Uint32Array(
    context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
  );
  return !pixelBuffer.some((color) => color !== 0);
}

async function handleInput(e) {
  if (isProcessing) return;

  const insertedChar = e.data || '';
  const isBoundary = isWordBoundary(insertedChar);

  // Update word buffer
  if (!isBoundary && insertedChar) {
    currentWordBuffer += insertedChar;
    return;
  }

  // Only process if we have a valid word
  if (currentWordBuffer && currentWordBuffer !== lastProcessedWord) {
    isProcessing = true;
    updateStatus("Checking word", true);
    
    try {
      console.log("Sending word to API:", currentWordBuffer);
      const corrected = await window.electronAPI.correctWord(currentWordBuffer);
      
      if (corrected && corrected !== currentWordBuffer) {
        showSuggestion(currentWordBuffer, corrected);
        updateStatus("Suggestion available", false, "success");
      }
    } catch (error) {
      console.error("API Error:", error);
      updateStatus("Correction failed", false, "error");
    } finally {
      isProcessing = false;
      lastProcessedWord = currentWordBuffer;
      currentWordBuffer = "";
    }
  }
}

// Handle key events
function handleKeyDown(e) {
  if (e.key === "Escape") {
    hideSuggestion();
  } else if (e.key === "Enter" && suggestionBox.classList.contains("visible")) {
    e.preventDefault();
    const firstSuggestion = suggestionBox.querySelector(".suggestion-item");
    if (firstSuggestion) firstSuggestion.click();
  }
}

// Status updates
function updateStatus(message, isProcessing, type = "") {
  statusText.textContent = message;
  status.className = "";

  if (isProcessing) {
    status.classList.add("processing");
    statusText.innerHTML = message + '<span class="loading-dots"></span>';
  } else if (type === "error") {
    status.classList.add("error");
  } else if (type === "success") {
    status.classList.add("success");
  }
}

// Show suggestion box
function showSuggestion(original, corrected) {
  suggestionBox.innerHTML = `
                <div class="suggestion-item" data-action="replace">
                    <div class="word-change">
                        <span class="original-word">${original}</span>
                        <span class="arrow">→</span>
                        <span class="corrected-word">${corrected}</span>
                    </div>
                </div>
                <div class="suggestion-item" data-action="ignore">
                    <span class="ignore-btn">Keep original</span>
                </div>
            `;

  positionSuggestionBox();
  suggestionBox.classList.add("visible");

  // Add event listeners to suggestion items
  suggestionBox.querySelectorAll(".suggestion-item").forEach((item) => {
    item.addEventListener("click", () => {
      if (item.dataset.action === "replace") {
        applyCorrection(original, corrected);
      }
      hideSuggestion();
      updateStatus("Correction applied", false, "success");
      setTimeout(() => updateStatus("Ready", false), 2000);
    });
  });
}

// Hide suggestion box
function hideSuggestion() {
  suggestionBox.classList.remove("visible");
}

// Position suggestion box near cursor
function positionSuggestionBox() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(false);
  const rect = range.getBoundingClientRect();

  suggestionBox.style.top = `${rect.bottom + window.scrollY + 8}px`;
  suggestionBox.style.left = `${rect.left + window.scrollX}px`;
}
function applyCorrection(original, corrected) {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  // Get the current range and selected text
  const range = selection.getRangeAt(0);
  const selectedText = range.toString();
  
  // If we have selected text that matches our original word
  if (selectedText === original) {
    // Create a new range for the replacement
    const newRange = document.createRange();
    newRange.setStart(range.startContainer, range.startOffset);
    newRange.setEnd(range.endContainer, range.endOffset);
    
    // Delete the original content
    newRange.deleteContents();
    
    // Insert the corrected text
    const textNode = document.createTextNode(corrected);
    newRange.insertNode(textNode);
    
    // Move cursor to end of corrected word
    selection.removeAllRanges();
    const newCursorPos = document.createRange();
    newCursorPos.setStartAfter(textNode);
    newCursorPos.collapse(true);
    selection.addRange(newCursorPos);
  } else {
    // Fallback - find and replace all instances (less ideal)
    const editorContent = editor.innerHTML;
    const updatedContent = editorContent.replace(
      new RegExp(escapeRegExp(original), 'g'), 
      corrected
    );
    editor.innerHTML = updatedContent;
  }
}

// Helper function to escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// Helper function to get current word
function getCurrentWord() {
  const text = editor.textContent || editor.innerText;
  const cursorPos = getCaretPosition(editor);
  
  let start = cursorPos;
  let end = cursorPos;

  // Find word start
  while (start > 0 && !isWordBoundary(text[start - 1])) {
    start--;
  }

  // Find word end
  while (end < text.length && !isWordBoundary(text[end])) {
    end++;
  }

  const word = text.substring(start, end);
  return { word, start, end };
}

// Helper to check for word boundaries
function isWordBoundary(char) {
  return /[\s.,!?;:]/.test(char);
}

// Helper functions for cursor position
function getCaretPosition(editableDiv) {
  let position = 0;
  const selection = window.getSelection();

  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const preRange = document.createRange();
    preRange.selectNodeContents(editableDiv);
    preRange.setEnd(range.startContainer, range.startOffset);
    position = preRange.toString().length;
  }

  return position;
}

function updateButtonStates() {
  document
    .querySelectorAll('.pad-button[data-command="bold"]')
    .forEach((btn) => {
      btn.classList.toggle("active", document.queryCommandState("bold"));
    });
  document
    .querySelectorAll('.pad-button[data-command="italic"]')
    .forEach((btn) => {
      btn.classList.toggle("active", document.queryCommandState("italic"));
    });
  document
    .querySelectorAll('.pad-button[data-command="underline"]')
    .forEach((btn) => {
      btn.classList.toggle("active", document.queryCommandState("underline"));
    });
}

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case "b":
        e.preventDefault();
        document.execCommand("bold", false, null);
        updateButtonStates();
        break;
      case "i":
        e.preventDefault();
        document.execCommand("italic", false, null);
        updateButtonStates();
        break;
      case "u":
        e.preventDefault();
        document.execCommand("underline", false, null);
        updateButtonStates();
        break;
      case "z":
        if (!e.shiftKey) {
          document.execCommand("undo", false, null);
        }
        break;
      case "y":
        document.execCommand("redo", false, null);
        break;
    }
  }
});
