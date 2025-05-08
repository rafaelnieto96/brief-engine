from flask import Flask, render_template, request, jsonify, send_from_directory
import cohere
import os
import sys
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
import tempfile
import PyPDF2
import docx2txt

# Load environment variables
load_dotenv()

app = Flask(__name__)
cohere_api_key = os.getenv('COHERE_API_KEY')

# Check for API key at startup
if not cohere_api_key:
    print("Error: No COHERE_API_KEY found in environment variables.")
    print("Please create a .env file with your Cohere API key.")
else:
    co = cohere.Client(cohere_api_key)

# Configure upload settings
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Max tokens for Cohere API
MAX_INPUT_TOKENS = 3500  # Leaving room for prompt and completion
MAX_CHUNK_LENGTH = 15000  # Approximate characters per chunk

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_file(file_path):
    """Extract text from supported file types"""
    file_extension = file_path.rsplit('.', 1)[1].lower()
    
    try:
        if file_extension == 'pdf':
            text = ""
            with open(file_path, 'rb') as f:
                pdf_reader = PyPDF2.PdfReader(f)
                for page_num in range(len(pdf_reader.pages)):
                    text += pdf_reader.pages[page_num].extract_text() + "\n"
            return text
            
        elif file_extension == 'docx':
            return docx2txt.process(file_path)
            
        elif file_extension == 'txt':
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        else:
            return None
    except Exception as e:
        print(f"Error extracting text from {file_path}: {str(e)}")
        return None

def chunk_text(text, max_length=MAX_CHUNK_LENGTH):
    """Split text into chunks of approximately max_length characters"""
    # If text is short enough, return it as a single chunk
    if len(text) <= max_length:
        return [text]
    
    chunks = []
    # Split text by paragraphs
    paragraphs = text.split('\n')
    current_chunk = ""
    
    for paragraph in paragraphs:
        # If adding this paragraph would exceed the max length, 
        # save the current chunk and start a new one
        if len(current_chunk) + len(paragraph) + 1 > max_length and current_chunk:
            chunks.append(current_chunk)
            current_chunk = paragraph + '\n'
        else:
            current_chunk += paragraph + '\n'
    
    # Add the last chunk if it has content
    if current_chunk:
        chunks.append(current_chunk)
    
    return chunks

def summarize_text(text, summary_length, summary_type, focus='balanced', tone='neutral'):
    """Generate summary for a text chunk"""
    prompt = f"""
<instruction>
You are an expert document summarizer. Create a {summary_length} length summary of the following text.

Rules:
- Provide ONLY the summary between <summary> and </summary> tags
- Format as {summary_type} style summary
- Focus primarily on {focus} content
- Use a {tone} tone
- Capture the key points and main ideas
- Be concise but comprehensive
- Preserve important details, names, dates, and facts
- Start directly with the content, without any introductory phrases
- NEVER start with "This document", "This text", "The document", "The text", or similar phrases
- NEVER use phrases like "This document discusses", "This text explains", or "The content describes"
- NEVER refer to the document, text, article, or content itself in any way
- NEVER use phrases like "Here is a summary" or "In conclusion"
- NEVER include introductions, conclusions, or meta-commentary
- Present the information directly as standalone content

Example of what to avoid:
"This document serves as an overview for a Machine Learning course..."
"The text explains that machine learning requires basic computer science expertise..."
"Here is a cohesive medium combined summary of the sections..."

Example of good output format for paragraph style:
"Machine Learning courses require basic computer science expertise. Students need knowledge of data structures and Big O notation. The course emphasizes application across various domains."

Example of good output format for bullet points:
"• Machine Learning requires basic computer science expertise
• Students need knowledge of data structures and Big O notation
• The course emphasizes application across various domains"
</instruction>

<text>
{text}
</text>

<summary>
"""
    response = co.generate(
        prompt=prompt,
        temperature=0.1,
        stop_sequences=["</summary>"],
        max_tokens=1024,
        return_likelihoods='NONE'
    )
    
    summary = response.generations[0].text.strip()
    
    # Clean response to extract only content within tags
    if "</summary>" in summary:
        summary = summary.split("</summary>")[0]
        
    # Remove any <summary> tag that might remain at the beginning
    summary = summary.replace("<summary>", "")
    
    return summary

def get_combined_summary(chunks, summary_length, summary_type, focus='balanced', tone='neutral'):
    """Process each chunk and combine the summaries"""
    # For a single chunk, just summarize it directly
    if len(chunks) == 1:
        return summarize_text(chunks[0], summary_length, summary_type, focus, tone)
    
    # For multiple chunks, summarize each and then summarize the combined result
    chunk_summaries = []
    for i, chunk in enumerate(chunks):
        chunk_summary = summarize_text(chunk, summary_length, summary_type, focus, tone)
        chunk_summaries.append(chunk_summary)
    
    # If we have multiple summaries, create a meta-summary
    if len(chunk_summaries) > 1:
        combined_text = "\n\n".join(chunk_summaries)
        meta_prompt = f"""
<instruction>
You are an expert document summarizer. Below are several summaries of different sections of a document.
Create a cohesive {summary_length} combined summary from these section summaries.

Rules:
- Provide ONLY the summary between <summary> and </summary> tags
- Format as {summary_type} style summary
- Focus primarily on {focus} content
- Use a {tone} tone
- Combine all important information
- Eliminate redundancies
- Create a smooth, cohesive summary
- Start directly with the content, without any introductory phrases
- NEVER start with "This document", "This text", "The document", "The text", or similar phrases
- NEVER use phrases like "This document discusses", "This text explains", or "The content describes"
- NEVER refer to the document, text, article, or content itself in any way
- NEVER use phrases like "Based on the summaries" or "The documents discuss"
- NEVER include introductions, conclusions, or meta-commentary
- Present the information directly as standalone content

Example of what to avoid:
"This document serves as an overview for a Machine Learning course..."
"Based on the summaries, machine learning requires basic computer science expertise..."
"Here is a cohesive medium combined summary of the sections..."

Example of good output format for paragraph style:
"Machine Learning courses require basic computer science expertise. Students need knowledge of data structures and Big O notation. The course emphasizes application across various domains."

Example of good output format for bullet points:
"• Machine Learning requires basic computer science expertise
• Students need knowledge of data structures and Big O notation
• The course emphasizes application across various domains"
</instruction>

<section_summaries>
{combined_text}
</section_summaries>

<summary>
"""
        response = co.generate(
            prompt=meta_prompt,
            temperature=0.1,
            stop_sequences=["</summary>"],
            max_tokens=1024,
            return_likelihoods='NONE'
        )
        
        final_summary = response.generations[0].text.strip()
        
        # Clean response
        if "</summary>" in final_summary:
            final_summary = final_summary.split("</summary>")[0]
            
        final_summary = final_summary.replace("<summary>", "")
        
        return final_summary
    else:
        return chunk_summaries[0]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/summarize', methods=['POST'])
def summarize():
    if not cohere_api_key:
        return jsonify({'error': 'Cohere API key not configured properly. Please check server configuration.'}), 500
    
    data = request.json
    text = data.get('text')
    summary_length = data.get('summary_length', 'medium')
    summary_type = data.get('summary_type', 'paragraph')
    focus = data.get('focus', 'balanced')
    tone = data.get('tone', 'neutral')
    
    if not text:
        return jsonify({'error': 'Missing text content'}), 400
    
    try:
        # Check if text needs to be chunked
        text_chunks = chunk_text(text)
        print(f"Text divided into {len(text_chunks)} chunks for processing")
        
        # Process chunks and get combined summary
        summary = get_combined_summary(text_chunks, summary_length, summary_type, focus, tone)
        
        return jsonify({'summary': summary})
    
    except cohere.CohereAPIError as e:
        error_message = f"Cohere API error: {str(e)}"
        print(error_message, file=sys.stderr)
        return jsonify({'error': error_message}), 500
    except cohere.CohereError as e:
        error_message = f"Cohere client error: {str(e)}"
        print(error_message, file=sys.stderr)
        return jsonify({'error': error_message}), 500
    except Exception as e:
        error_message = f"Unexpected error: {str(e)}"
        print(error_message, file=sys.stderr)
        return jsonify({'error': error_message}), 500

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
        
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
        
    if not allowed_file(file.filename):
        return jsonify({'error': f'File type not supported. Allowed types: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
    
    try:
        # Create a secure filename and save temporarily
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Extract text from file
        text = extract_text_from_file(file_path)
        
        # Remove the file after extracting text
        if os.path.exists(file_path):
            os.remove(file_path)
        
        if not text or len(text.strip()) == 0:
            return jsonify({'error': 'Could not extract text from the file or file is empty'}), 400
            
        return jsonify({
            'success': True,
            'text': text,
            'filename': filename
        })
        
    except Exception as e:
        error_message = f"Error processing uploaded file: {str(e)}"
        print(error_message, file=sys.stderr)
        
        # Clean up the file if it exists
        if 'file_path' in locals() and os.path.exists(file_path):
            os.remove(file_path)
            
        return jsonify({'error': error_message}), 500

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_ENV') == 'development'
    port = int(os.getenv('PORT', 5000))
    app.run(debug=debug_mode, port=port) 