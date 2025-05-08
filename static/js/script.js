document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const textTab = document.getElementById('text-tab');
    const uploadTab = document.getElementById('upload-tab');
    const textInputSection = document.getElementById('text-input-section');
    const fileUploadSection = document.getElementById('file-upload-section');
    const inputText = document.getElementById('input-text');

    // Options selectors
    const summaryLengthText = document.getElementById('summary-length-text');
    const summaryTypeText = document.getElementById('summary-type-text');
    const summaryLengthUpload = document.getElementById('summary-length-upload');
    const summaryTypeUpload = document.getElementById('summary-type-upload');
    const summarizeTextBtn = document.getElementById('summarize-text-btn');
    const summarizeUploadBtn = document.getElementById('summarize-upload-btn');

    // Message containers
    const textMessage = document.getElementById('text-message');
    const uploadMessage = document.getElementById('upload-message');

    const summaryResult = document.getElementById('summary-result');
    const copyBtn = document.getElementById('copy-btn');
    const loadingOverlay = document.getElementById('loading-overlay');
    const fileUpload = document.getElementById('file-upload');
    const uploadArea = document.querySelector('.upload-area');

    // Store document content after upload
    let uploadedDocumentText = '';
    let uploadedFileName = '';

    // Ensure correct state at startup
    function initializeTabs() {
        console.log("Initializing tabs");

        // Remove all active classes first
        textTab.classList.remove('active');
        uploadTab.classList.remove('active');
        textInputSection.classList.remove('active');
        fileUploadSection.classList.remove('active');

        // Set default active tab (upload)
        uploadTab.classList.add('active');
        fileUploadSection.classList.add('active');
    }

    // Run initialization
    initializeTabs();
    console.log("DOM Elements loaded");

    // Tab switching - with cleanup
    textTab.addEventListener('click', function (e) {
        e.preventDefault();
        console.log("Text tab clicked");

        // Switch tabs
        textTab.classList.add('active');
        uploadTab.classList.remove('active');

        // Toggle content sections
        textInputSection.classList.add('active');
        fileUploadSection.classList.remove('active');

        // Clear upload tab data
        uploadedDocumentText = '';
        uploadedFileName = '';
        fileUpload.value = '';
        clearMessage(uploadMessage);

        // Reset summary result to default
        resetSummaryResult();

        console.log("Text tab activated:",
            textInputSection.classList.contains('active'),
            fileUploadSection.classList.contains('active')
        );
    });

    uploadTab.addEventListener('click', function (e) {
        e.preventDefault();
        console.log("Upload tab clicked");

        // Switch tabs
        uploadTab.classList.add('active');
        textTab.classList.remove('active');

        // Toggle content sections
        fileUploadSection.classList.add('active');
        textInputSection.classList.remove('active');

        // Clear text input
        inputText.value = '';
        clearMessage(textMessage);

        // Reset summary result to default
        resetSummaryResult();

        console.log("Upload tab activated:",
            fileUploadSection.classList.contains('active'),
            textInputSection.classList.contains('active')
        );
    });

    // Reset summary to default state
    function resetSummaryResult() {
        summaryResult.innerHTML = '<p class="placeholder-text">Your summary will appear here...</p>';
        copyBtn.disabled = true;
    }

    // Make the entire upload area clickable to trigger file input
    uploadArea.addEventListener('click', function (e) {
        console.log("Upload area clicked");
        // Only trigger if the click wasn't on the file input itself
        if (e.target !== fileUpload) {
            fileUpload.click();
        }
    });

    // File Upload with Drag and Drop functionality
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        uploadArea.classList.add('highlight');
    }

    function unhighlight() {
        uploadArea.classList.remove('highlight');
    }

    uploadArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        console.log("File dropped");
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) {
            fileUpload.files = files;
            handleFiles(files[0]);
        }
    }

    fileUpload.addEventListener('change', function (e) {
        console.log("File input changed");
        if (this.files.length) {
            handleFiles(this.files[0]);
        }
    });

    function handleFiles(file) {
        console.log("Handling file:", file.name);
        const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
        const maxFileSize = 16 * 1024 * 1024; // 16MB

        // Also accept files based on extension in case MIME type isn't correctly detected
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const validExtensions = ['pdf', 'docx', 'txt'];

        if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
            showUploadMessage('Invalid file type. Please upload a PDF, DOCX, or TXT file.', 'error');
            return;
        }

        if (file.size > maxFileSize) {
            showUploadMessage('File too large. Maximum file size is 16MB.', 'error');
            return;
        }

        uploadFile(file);
    }

    function uploadFile(file) {
        console.log("Uploading file to server");
        loadingOverlay.classList.add('active');
        loadingOverlay.querySelector('p').textContent = 'Processing document data stream...';

        const formData = new FormData();
        formData.append('file', file);

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
            .then(response => {
                console.log("Server response received", response.status);
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || 'Server error');
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log("Upload successful, data received");
                if (data.success && data.text) {
                    // Store the document text and filename
                    uploadedDocumentText = data.text;
                    uploadedFileName = data.filename;

                    // Show success message in upload area
                    showUploadMessage(`Document "${data.filename}" processed successfully. Click "Generate" to create a summary.`, 'success');

                    // The user stays in the Upload tab and can click the generate button there
                } else {
                    throw new Error(data.error || 'Unknown error occurred');
                }
            })
            .catch(error => {
                console.error("Upload error:", error);
                showUploadMessage(`File upload failed: ${error.message}`, 'error');
            })
            .finally(() => {
                loadingOverlay.classList.remove('active');
            });
    }

    // Generate summary from text input
    summarizeTextBtn.addEventListener('click', function () {
        console.log("Generate button clicked in text tab");
        const text = inputText.value.trim();

        if (!text) {
            showTextMessage('Please enter some text to summarize.', 'error');
            return;
        }

        if (text.length < 50) {
            showTextMessage('Please enter a longer text for better summarization (at least 50 characters).', 'error');
            return;
        }

        // Clear any previous messages
        clearMessage(textMessage);

        generateSummary(
            text,
            summaryLengthText.value,
            summaryTypeText.value
        );
    });

    // Generate summary from uploaded document
    summarizeUploadBtn.addEventListener('click', function () {
        console.log("Generate button clicked in upload tab");

        if (!uploadedDocumentText) {
            showUploadMessage('Please upload a document first.', 'error');
            return;
        }

        // Clear any previous messages
        clearMessage(uploadMessage);

        generateSummary(
            uploadedDocumentText,
            summaryLengthUpload.value,
            summaryTypeUpload.value
        );
    });

    // Copy to clipboard functionality
    copyBtn.addEventListener('click', function () {
        console.log("Copy button clicked");
        const summaryText = summaryResult.innerText;
        if (summaryText && !summaryText.includes('Your summary will appear here')) {
            navigator.clipboard.writeText(summaryText)
                .then(() => {
                    const originalText = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => {
                        copyBtn.innerHTML = originalText;
                    }, 2000);
                })
                .catch(err => {
                    console.error('Could not copy text: ', err);
                });
        }
    });

    function generateSummary(text, length, type) {
        console.log("Generating summary with:", { length, type });
        // Show loading overlay
        loadingOverlay.classList.add('active');
        loadingOverlay.querySelector('p').textContent = 'Neural processing in progress...';

        // Check text length - approximately 3 chars per token as a more conservative estimate
        const estimatedTokens = text.length / 3;
        const MAX_TOKENS = 3800; // More conservative limit (Cohere's max is 4081)

        if (estimatedTokens > MAX_TOKENS) {
            console.log(`Text too long (est. ${Math.round(estimatedTokens)} tokens), chunking text`);
            // Text is too long, we need to chunk it
            const chunks = chunkText(text);
            processSummaryInChunks(chunks, length, type);
            return;
        }

        // Prepare request data for normal-sized text
        const requestData = {
            text: text,
            summary_length: length,
            summary_type: type
        };

        console.log("Sending API request with data:", requestData);

        // Make API call
        fetch('/summarize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
            .then(response => {
                console.log("API response received", response.status);
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || `Server error: ${response.status}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log("Summary generation successful");
                // Hide loading overlay
                loadingOverlay.classList.remove('active');

                if (data.error) {
                    showError(data.error);
                    return;
                }

                // Display the summary
                summaryResult.innerHTML = data.summary;

                // Enable copy button
                copyBtn.disabled = false;
            })
            .catch(error => {
                console.error("Summary generation error:", error);
                // Hide loading overlay
                loadingOverlay.classList.remove('active');

                console.error('Error:', error);
                showError(`Failed to generate summary: ${error.message}`);
            });
    }

    // Split text into manageable chunks
    function chunkText(text, maxLength = 10000) {
        // If text is short enough, return it as a single chunk
        if (text.length <= maxLength) {
            return [text];
        }

        const chunks = [];
        // Split text by paragraphs
        const paragraphs = text.split('\n');
        let currentChunk = "";

        for (const paragraph of paragraphs) {
            // If adding this paragraph would exceed the max length, 
            // save the current chunk and start a new one
            if (currentChunk.length + paragraph.length + 1 > maxLength && currentChunk) {
                chunks.push(currentChunk);
                currentChunk = paragraph + '\n';
            } else {
                currentChunk += paragraph + '\n';
            }
        }

        // Add the last chunk if it has content
        if (currentChunk) {
            chunks.push(currentChunk);
        }

        // If we still have chunks that might be too large, split them further
        const finalChunks = [];
        const ABSOLUTE_MAX = 10000;

        for (const chunk of chunks) {
            if (chunk.length > ABSOLUTE_MAX) {
                // Split into fixed-size chunks as a fallback
                for (let i = 0; i < chunk.length; i += ABSOLUTE_MAX / 2) {
                    finalChunks.push(chunk.substring(i, i + ABSOLUTE_MAX / 2));
                }
            } else {
                finalChunks.push(chunk);
            }
        }

        console.log(`Text divided into ${finalChunks.length} chunks for processing`);
        return finalChunks;
    }

    // Process each chunk and combine results
    function processSummaryInChunks(chunks, length, type) {
        console.log(`Processing ${chunks.length} chunks sequentially`);

        // Show more detailed loading message
        loadingOverlay.querySelector('p').textContent = `Preparing to process ${chunks.length} parts...`;

        const processNextChunk = (index, summaries) => {
            if (index >= chunks.length) {
                // All chunks processed, combine summaries
                if (summaries.length === 1) {
                    // Only one summary, no need to combine
                    displayFinalSummary(summaries[0]);
                } else {
                    // Multiple summaries, combine them
                    combineChunkSummaries(summaries, length, type);
                }
                return;
            }

            // Update loading message with progress
            const progressPct = Math.round((index / chunks.length) * 100);
            loadingOverlay.querySelector('p').textContent = `Processing part ${index + 1} of ${chunks.length} (${progressPct}%)...`;

            // Sanitize chunk (remove any potentially problematic sequences)
            const sanitizedChunk = sanitizeText(chunks[index]);

            // Send request for current chunk
            const requestData = {
                text: sanitizedChunk,
                summary_length: length,
                summary_type: type
            };

            fetch('/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(data => {
                            throw new Error(data.error || `Server error: ${response.status}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.error) {
                        throw new Error(data.error);
                    }

                    // Add this summary to our collection
                    summaries.push(data.summary);

                    // Process next chunk
                    processNextChunk(index + 1, summaries);
                })
                .catch(error => {
                    console.error(`Error processing chunk ${index + 1}:`, error);

                    // Handle specific Cohere token errors by reducing chunk size and retrying
                    if (error.message && error.message.includes("too many tokens")) {
                        console.log("Token limit exceeded. Splitting chunk and retrying...");

                        // Split the current chunk in half and insert both halves back into the chunks array
                        const currentChunk = chunks[index];
                        const midpoint = Math.floor(currentChunk.length / 2);
                        const firstHalf = currentChunk.substring(0, midpoint);
                        const secondHalf = currentChunk.substring(midpoint);

                        // Remove the current chunk and insert the split chunks
                        chunks.splice(index, 1, firstHalf, secondHalf);

                        // Try the first half immediately
                        processNextChunk(index, summaries);
                    } else {
                        // For other errors, show the error and stop processing
                        loadingOverlay.classList.remove('active');
                        showError(`Failed to process part ${index + 1}: ${error.message}`);
                    }
                });
        };

        // Start processing with the first chunk
        processNextChunk(0, []);
    }

    // Sanitize text to avoid token-related issues
    function sanitizeText(text) {
        if (!text) return "";

        // Replace very long sequences of repeated characters
        let sanitized = text.replace(/(.)\1{50,}/g, "$1$1$1... [repetition removed] ...$1$1$1");

        // Replace extremely long words that might cause tokenization issues
        sanitized = sanitized.replace(/\b\w{100,}\b/g, "[very long word removed]");

        // Remove control characters that may cause issues
        sanitized = sanitized.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "");

        return sanitized;
    }

    // Combine summaries from multiple chunks
    function combineChunkSummaries(summaries, length, type) {
        console.log("Combining summaries from multiple chunks");
        loadingOverlay.querySelector('p').textContent = 'Creating final summary...';

        const combinedText = summaries.join("\n\n");

        // Send a meta-summarization request
        const requestData = {
            text: combinedText,
            summary_length: length,
            summary_type: type
        };

        fetch('/summarize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || `Server error: ${response.status}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }

                // Display the final summary
                displayFinalSummary(data.summary);
            })
            .catch(error => {
                loadingOverlay.classList.remove('active');
                showError(`Failed to combine summaries: ${error.message}`);
            });
    }

    // Display the final summary result
    function displayFinalSummary(summary) {
        console.log("Displaying final summary");
        loadingOverlay.classList.remove('active');

        // Display the summary
        summaryResult.innerHTML = summary;

        // Enable copy button
        copyBtn.disabled = false;
    }

    // Function to show error messages in summary section
    function showError(message) {
        loadingOverlay.classList.remove('active');
        console.error(message);
        alert('Error: ' + message);
        summaryResult.innerHTML = `<p class="error-message" style="color: var(--error-color);">${message}</p>`;
        copyBtn.disabled = true;
    }

    // Function to show text message in text input section
    function showTextMessage(message, type) {
        textMessage.innerHTML = `<p>${message}</p>`;
        textMessage.className = 'message-container';
        textMessage.classList.add(type);
        textMessage.style.opacity = '1';
        textMessage.style.visibility = 'visible';
        textMessage.style.transform = 'translateY(0)';
    }

    // Function to show upload message in upload section
    function showUploadMessage(message, type) {
        uploadMessage.innerHTML = `<p>${message}</p>`;
        uploadMessage.className = 'message-container';
        uploadMessage.classList.add(type);
        uploadMessage.style.opacity = '1';
        uploadMessage.style.visibility = 'visible';
        uploadMessage.style.transform = 'translateY(0)';
    }

    // Function to clear a message container
    function clearMessage(container) {
        container.innerHTML = '';
        container.className = 'message-container';
        container.style.opacity = '0';
        container.style.visibility = 'hidden';
        container.style.transform = 'translateY(10px)';
    }

    console.log("JavaScript initialization complete");

    // Custom select dropdown implementation
    console.log("Initializing custom select dropdowns");
    const selects = document.querySelectorAll('select');

    selects.forEach(select => {
        // Hide the original select element carefully to keep it functional but not visible
        select.style.position = 'absolute';
        select.style.opacity = '0';
        select.style.pointerEvents = 'none';
        select.style.height = '0';
        select.style.width = '0';
        select.style.margin = '-1px'; // Ensure it doesn't take up space

        // Create a new div to act as the styled select box
        const styledSelect = document.createElement('div');
        styledSelect.className = 'styled-select-trigger'; // New class for the trigger
        styledSelect.setAttribute('tabindex', '0'); // Make it focusable

        const displayValue = document.createElement('span');
        displayValue.className = 'styled-select-value';
        displayValue.textContent = select.options[select.selectedIndex].text;
        styledSelect.appendChild(displayValue);

        const arrow = document.createElement('div');
        arrow.className = 'select-arrow'; // Use existing arrow style
        styledSelect.appendChild(arrow);

        // Insert the styled select before the original select
        select.parentNode.insertBefore(styledSelect, select);

        // Create custom select dropdown container
        const customDropdown = document.createElement('div');
        customDropdown.className = 'custom-select-dropdown';
        document.body.appendChild(customDropdown); // Append to body

        // Create options
        Array.from(select.options).forEach((option, index) => {
            const customOption = document.createElement('div');
            customOption.className = 'custom-select-option';
            if (option.selected) customOption.className += ' selected';
            customOption.textContent = option.text;
            customOption.dataset.value = option.value;
            customOption.dataset.index = index;

            customOption.addEventListener('click', function (e) {
                e.stopPropagation(); // Prevent click from closing immediately
                console.log(`Custom option clicked: ${this.textContent}, index: ${this.dataset.index}`);
                select.selectedIndex = this.dataset.index;
                displayValue.textContent = this.textContent; // Update displayed value

                customDropdown.querySelectorAll('.custom-select-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                this.classList.add('selected');
                customDropdown.style.display = 'none';
                console.log("Custom dropdown hidden after option click");

                const event = new Event('change', { bubbles: true });
                select.dispatchEvent(event);
            });
            customDropdown.appendChild(customOption);
        });

        // Show/hide custom dropdown when clicking the styled select trigger
        styledSelect.addEventListener('click', function (e) {
            e.stopPropagation(); // Prevent click from bubbling to document listener immediately
            console.log("Styled select trigger clicked");

            // Close all other open dropdowns first
            document.querySelectorAll('.custom-select-dropdown').forEach(otherDropdown => {
                if (otherDropdown !== customDropdown) {
                    otherDropdown.style.display = 'none';
                }
            });

            const isVisible = customDropdown.style.display === 'block';
            if (isVisible) {
                customDropdown.style.display = 'none';
                console.log("Custom dropdown hidden");
            } else {
                const selectRect = styledSelect.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const isMobile = window.innerWidth <= 768; // Check if on mobile

                // Set initial position
                customDropdown.style.left = (selectRect.left + window.scrollX) + 'px';
                customDropdown.style.width = selectRect.width + 'px';

                // First append to document to get its height
                customDropdown.style.visibility = 'hidden';
                customDropdown.style.display = 'block';

                // Get dropdown height after it's in the DOM with content
                const dropdownHeight = customDropdown.offsetHeight;

                // Check if dropdown would go off screen
                const spaceBelow = viewportHeight - selectRect.bottom;

                if (dropdownHeight > spaceBelow) {
                    // Not enough space below, position above if possible
                    if (dropdownHeight < selectRect.top) {
                        // Enough space above, position above the select
                        customDropdown.style.top = (selectRect.top + window.scrollY - dropdownHeight) + 'px';
                    } else {
                        // Not enough space above either, set max-height and position below
                        customDropdown.style.top = (selectRect.bottom + window.scrollY) + 'px';
                        customDropdown.style.maxHeight = (spaceBelow - 20) + 'px'; // 20px buffer
                        customDropdown.style.overflowY = 'auto';

                        // On mobile, make sure the dropdown isn't too tall
                        if (isMobile) {
                            const maxMobileHeight = Math.min(200, spaceBelow - 20);
                            customDropdown.style.maxHeight = maxMobileHeight + 'px';
                        }
                    }
                } else {
                    // Enough space below, position below as normal
                    customDropdown.style.top = (selectRect.bottom + window.scrollY) + 'px';
                    // Reset max-height if it was previously set
                    customDropdown.style.maxHeight = '';

                    // On mobile, make sure the dropdown isn't too tall
                    if (isMobile) {
                        customDropdown.style.maxHeight = Math.min(200, spaceBelow - 20) + 'px';
                    }
                }

                // For mobile, ensure the dropdown stays within horizontal bounds as well
                if (isMobile) {
                    const viewportWidth = window.innerWidth;
                    const dropdownRight = selectRect.left + customDropdown.offsetWidth;

                    if (dropdownRight > viewportWidth) {
                        const overflow = dropdownRight - viewportWidth;
                        customDropdown.style.left = (selectRect.left - overflow - 10) + 'px'; // 10px buffer
                    }
                }

                // Make visible again
                customDropdown.style.visibility = 'visible';
                console.log(`Custom dropdown shown at top: ${customDropdown.style.top}, left: ${customDropdown.style.left}, maxHeight: ${customDropdown.style.maxHeight}`);

                // Scroll to selected item
                customDropdown.scrollTop = 0;
                const selectedOptionEl = customDropdown.querySelector('.custom-select-option.selected');
                if (selectedOptionEl) {
                    selectedOptionEl.scrollIntoView({ block: 'nearest' });
                }
            }
        });
        // Also handle focus and keyboard for accessibility (Enter/Space to open)
        styledSelect.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                styledSelect.click(); // Trigger the click handler
            }
        });
    });

    // Hide all dropdowns when clicking elsewhere
    document.addEventListener('click', function (e) {
        let clickedInsideDropdown = false;
        document.querySelectorAll('.custom-select-dropdown').forEach(dropdown => {
            if (dropdown.contains(e.target)) {
                clickedInsideDropdown = true;
            }
        });

        if (!e.target.closest('.styled-select-trigger') && !clickedInsideDropdown) {
            document.querySelectorAll('.custom-select-dropdown').forEach(dropdown => {
                if (dropdown.style.display === 'block') {
                    dropdown.style.display = 'none';
                    console.log("Custom dropdown hidden due to outside click");
                }
            });
        }
    });
}); 