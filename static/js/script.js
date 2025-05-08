document.addEventListener('DOMContentLoaded', function() {
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
    textTab.addEventListener('click', function(e) {
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

    uploadTab.addEventListener('click', function(e) {
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
    uploadArea.addEventListener('click', function(e) {
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

    fileUpload.addEventListener('change', function(e) {
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
    summarizeTextBtn.addEventListener('click', function() {
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
    summarizeUploadBtn.addEventListener('click', function() {
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
    copyBtn.addEventListener('click', function() {
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

    // Function to generate summary via API
    function generateSummary(text, length, type) {
        console.log("Generating summary with:", { length, type });
        // Show loading overlay
        loadingOverlay.classList.add('active');
        loadingOverlay.querySelector('p').textContent = 'Neural processing in progress...';
        
        // Prepare request data
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
}); 