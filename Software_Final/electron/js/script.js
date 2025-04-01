// DOM Elements
const editor = document.getElementById("editor");
const status = document.getElementById("status");
const statusText = document.getElementById("status-text");
const statusIcon = document.getElementById("status-icon");
const suggestionBox = document.getElementById("suggestion");
const collectionBtn = document.getElementById("collection-btn");

// State
let lastProcessedWord = "";
let isProcessing = false;
let currentSelection = null;
let isCollecting = false;

// Event Listeners
editor.addEventListener("input", handleInput);
editor.addEventListener("keydown", handleKeyDown);
editor.addEventListener("click", hideSuggestion);
document.addEventListener("click", (e) => {
  if (!suggestionBox.contains(e.target)) {
    hideSuggestion();
  }
});
document
  .getElementById("correct-last-word")
  .addEventListener("click", correctLastWord);

collectionBtn.addEventListener("click", toggleDataCollection);

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

async function toggleDataCollection() {
  try {
    if (isCollecting) {
      await stopDataCollection();
    } else {
      await startDataCollection();
    }
    updateCollectionButton();
  } catch (error) {
    console.error("Toggle error:", error);
    updateStatus("Operation failed: " + error.message, false, "error");
  }
}

function updateCollectionButton() {
  if (isCollecting) {
    collectionBtn.textContent = "Stop Collection";
    collectionBtn.classList.add("stop");
    collectionBtn.classList.remove("start");
  } else {
    collectionBtn.textContent = "Start Collection";
    collectionBtn.classList.add("start");
    collectionBtn.classList.remove("stop");
  }
}

async function startDataCollection() {
  try {
    updateStatus("Starting data collection...", true);

    const response = await fetch("http://127.0.0.1:5000/start", {
      method: "POST",
    });

    const data = await response.json();

    if (data.status === "started") {
      isCollecting = true;
      updateStatus(
        "Collecting IMU data...",
        false,
        "success"
      );
    } else {
      throw new Error(data.message || "Failed to start collection");
    }
  } catch (error) {
    console.error("Start error:", error);
    updateStatus("Start failed: " + error.message, false, "error");
    throw error; // Re-throw to be caught in toggleDataCollection
  } finally {
    updateCollectionButton();
  }
}

async function stopDataCollection() {
  try {
    updateStatus("Stopping data collection...", true);

    const response = await fetch("http://127.0.0.1:5000/stop", {
      method: "POST",
    });

    const data = await response.json();

    if (data.character) {
      const confidencePercent = (data.confidence * 100).toFixed(1);
      updateStatus(
        `Predicted character: ${data.character} (${confidencePercent}% confidence)`,
        false,
        "success"
      );
      console.log(
        `Predicted character: ${data.character} (${confidencePercent}% confidence)`
      );
      // Insert the predicted character into editor
      insertTextAtCursor(data.character);
    } else {
      throw new Error(data.message || "No prediction received");
    }
  } catch (error) {
    console.error("Stop error:", error);
    updateStatus("Stop failed: " + error.message, false, "error");
    throw error; // Re-throw to be caught in toggleDataCollection
  } finally {
    isCollecting = false;
    updateCollectionButton();
    if (!statusText.textContent.includes("Predicted character")) {
      updateStatus("Ready", false);
    }
  }
}

function insertTextAtCursor(text) {
  // Remove any trailing space if present
  const textToInsert = text.endsWith(' ') ? text.slice(0, -1) : text;
  
  // Try to get current selection
  const selection = window.getSelection();
  
  if (selection.rangeCount > 0) {
    try {
      // If there's a selection, replace it
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      // Create a text node and insert it
      const textNode = document.createTextNode(textToInsert);
      range.insertNode(textNode);
      
      // Move cursor to end of inserted text
      const newRange = document.createRange();
      newRange.setStart(textNode, textNode.length);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } catch (error) {
      console.error("Error inserting at selection:", error);
      // Fallback to appending at the end
      appendToEditor(textToInsert);
    }
  } else {
    // If no selection, append to the editor
    appendToEditor(textToInsert);
  }
  
  // Ensure editor stays focused
  editor.focus();
}

function appendToEditor(text) {
  // Create a text node
  const textNode = document.createTextNode(text);
  
  // Append it to the editor
  editor.appendChild(textNode);
  
  // Move cursor to end
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

async function handleInput(e) {
  if (isProcessing) return;

  const insertedChar = e.data || "";

  // If space is pressed, process the last word
  if (insertedChar === " ") {
    await processLastWord();
  }
}

async function processLastWord() {
  if (isProcessing) return;

  const text = editor.textContent || editor.innerText;
  const words = text.trim().split(/\s+/);
  const lastWord = words[words.length - 1];

  if (!lastWord || lastWord === lastProcessedWord) return;

  isProcessing = true;
  updateStatus("Checking word", true);

  try {
    console.log("Sending word to API:", lastWord);
    const corrected = await window.electronAPI.correctWord(lastWord);

    if (corrected && corrected !== lastWord) {
      showSuggestion(lastWord, corrected);
      updateStatus("Suggestion available", false, "success");
    }
  } catch (error) {
    console.error("API Error:", error);
    updateStatus("Correction failed", false, "error");
  } finally {
    isProcessing = false;
    lastProcessedWord = lastWord;
  }
}

async function correctLastWord() {
  await processLastWord();
}

function handleKeyDown(e) {
  if (e.key === "Escape") {
    hideSuggestion();
  } else if (e.key === "Enter" && suggestionBox.classList.contains("visible")) {
    e.preventDefault();
    const firstSuggestion = suggestionBox.querySelector(".suggestion-item");
    if (firstSuggestion) firstSuggestion.click();
  }
}

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

function hideSuggestion() {
  suggestionBox.classList.remove("visible");
}

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

  const range = selection.getRangeAt(0);
  const selectedText = range.toString();

  if (selectedText === original) {
    const newRange = document.createRange();
    newRange.setStart(range.startContainer, range.startOffset);
    newRange.setEnd(range.endContainer, range.endOffset);
    newRange.deleteContents();
    const textNode = document.createTextNode(corrected + " ");
    newRange.insertNode(textNode);

    selection.removeAllRanges();
    const newCursorPos = document.createRange();
    newCursorPos.setStartAfter(textNode);
    newCursorPos.collapse(true);
    selection.addRange(newCursorPos);
  } else {
    const text = editor.textContent || editor.innerText;
    const lastIndex = text.lastIndexOf(original);

    if (lastIndex !== -1) {
      const before = text.substring(0, lastIndex);
      const after = text.substring(lastIndex + original.length);
      editor.textContent = before + corrected + " " + after;
      setCaretPosition(editor, lastIndex + corrected.length + 1);
    } else {
      const editorContent = editor.innerHTML;
      const updatedContent = editorContent.replace(
        new RegExp(escapeRegExp(original), "g"),
        corrected + " "
      );
      editor.innerHTML = updatedContent;
    }
  }
}

function setCaretPosition(element, offset) {
  const range = document.createRange();
  const selection = window.getSelection();
  let pos = 0;
  const textNodes = getTextNodes(element);
  let targetNode = textNodes[0];
  let targetOffset = offset;

  for (const node of textNodes) {
    if (pos + node.length >= offset) {
      targetNode = node;
      targetOffset = offset - pos;
      break;
    }
    pos += node.length;
  }

  range.setStart(targetNode, Math.min(targetOffset, targetNode.length));
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getTextNodes(element) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  return textNodes;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getCurrentWord() {
  const text = editor.textContent || editor.innerText;
  const cursorPos = getCaretPosition(editor);

  let start = cursorPos;
  let end = cursorPos;

  while (start > 0 && !isWordBoundary(text[start - 1])) {
    start--;
  }

  while (end < text.length && !isWordBoundary(text[end])) {
    end++;
  }

  const word = text.substring(start, end);
  return { word, start, end };
}

function isWordBoundary(char) {
  return /[\s.,!?;:]/.test(char);
}

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