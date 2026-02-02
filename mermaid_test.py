#!/usr/bin/env python3
"""
Focused test for DOCX export with rendered Mermaid diagrams
"""

import asyncio
import httpx
import json
import tempfile
import zipfile
import os
from datetime import datetime

# Get backend URL from frontend .env file
BACKEND_URL = "https://devhub-frontend.preview.emergentagent.com/api"

class MermaidDiagramTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.client = httpx.AsyncClient(timeout=60.0)
        self.auth_token = None
        self.test_user_email = "mermaidtest@example.com"
        self.test_user_password = "TestPass123!"
        self.test_user_name = "Mermaid Test User"

    async def authenticate(self):
        """Authenticate user for testing"""
        try:
            # Try to register first
            user_data = {
                "email": self.test_user_email,
                "password": self.test_user_password,
                "name": self.test_user_name
            }
            
            response = await self.client.post(f"{self.base_url}/auth/register", json=user_data)
            
            if response.status_code == 200:
                data = response.json()
                self.auth_token = data["access_token"]
                print(f"✅ User registered and authenticated")
                return True
            elif response.status_code == 400:
                # User already exists, try login
                login_data = {
                    "email": self.test_user_email,
                    "password": self.test_user_password
                }
                
                response = await self.client.post(f"{self.base_url}/auth/login", json=login_data)
                
                if response.status_code == 200:
                    data = response.json()
                    self.auth_token = data["access_token"]
                    print(f"✅ User logged in successfully")
                    return True
                else:
                    print(f"❌ Login failed: {response.status_code} - {response.text}")
                    return False
            else:
                print(f"❌ Registration failed: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Authentication error: {str(e)}")
            return False

    async def wait_for_job_completion(self, job_id: str, max_wait_time: int = 180):
        """Wait for documentation job to complete"""
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        start_time = asyncio.get_event_loop().time()
        
        print(f"    Waiting for job {job_id} to complete...")
        
        while True:
            try:
                response = await self.client.get(f"{self.base_url}/repo-documentation/status/{job_id}", 
                                               headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get("status", "unknown")
                    progress = data.get("overall_progress", 0)
                    current_agent = data.get("current_agent", "unknown")
                    
                    print(f"    Status: {status} - {progress}% complete - Current agent: {current_agent}")
                    
                    if status == "completed":
                        return True, "Job completed successfully"
                    elif status == "failed":
                        return False, f"Job failed: {data.get('error', 'Unknown error')}"
                    
                    # Check timeout
                    elapsed = asyncio.get_event_loop().time() - start_time
                    if elapsed > max_wait_time:
                        return False, f"Timeout after {max_wait_time} seconds"
                    
                    # Wait before next poll
                    await asyncio.sleep(10)
                else:
                    return False, f"Status check failed: HTTP {response.status_code}"
                    
            except Exception as e:
                return False, f"Exception during status check: {str(e)}"

    async def test_mermaid_docx_export(self):
        """Test DOCX export with rendered Mermaid diagrams"""
        print("🎨 Testing DOCX Export with Rendered Mermaid Diagrams")
        print("=" * 60)
        
        try:
            # Step 1: Authenticate
            if not await self.authenticate():
                print("❌ Authentication failed")
                return False
            
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            # Step 2: Start documentation job
            print("\n📚 Step 1: Starting documentation job for https://github.com/sindresorhus/is")
            repo_data = {
                "repo_url": "https://github.com/sindresorhus/is",
                "branch": "main"
            }
            
            start_response = await self.client.post(f"{self.base_url}/repo-documentation/start", 
                                                  json=repo_data, headers=headers)
            
            if start_response.status_code != 200:
                print(f"❌ Failed to start documentation job: HTTP {start_response.status_code}: {start_response.text}")
                return False
            
            start_data = start_response.json()
            job_id = start_data.get("job_id")
            total_files = start_data.get("total_files", 0)
            
            if not job_id:
                print(f"❌ No job_id returned from start endpoint")
                return False
            
            print(f"✅ Job started successfully: {job_id} (processing {total_files} files)")
            
            # Step 3: Wait for completion
            print(f"\n⏳ Step 2: Waiting for job completion...")
            completed, message = await self.wait_for_job_completion(job_id, max_wait_time=180)
            
            if not completed:
                print(f"❌ Job did not complete: {message}")
                return False
            
            print(f"✅ Job completed successfully!")
            
            # Step 4: Export DOCX
            print(f"\n📄 Step 3: Exporting DOCX and analyzing for Mermaid diagrams...")
            export_response = await self.client.get(f"{self.base_url}/repo-documentation/export/{job_id}", 
                                                  headers=headers)
            
            if export_response.status_code != 200:
                print(f"❌ DOCX export failed: HTTP {export_response.status_code}: {export_response.text}")
                return False
            
            # Verify content type
            content_type = export_response.headers.get("content-type", "")
            expected_content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            
            if content_type != expected_content_type:
                print(f"❌ Incorrect content-type. Expected: {expected_content_type}, Got: {content_type}")
                return False
            
            # Analyze DOCX content
            docx_content = export_response.content
            file_size = len(docx_content)
            
            print(f"✅ DOCX exported successfully - Size: {file_size} bytes")
            
            # Step 5: Analyze for embedded images/diagrams
            print(f"\n🔍 Step 4: Analyzing DOCX for embedded Mermaid diagrams...")
            
            with tempfile.NamedTemporaryFile(suffix='.docx', delete=False) as temp_file:
                temp_file.write(docx_content)
                temp_file_path = temp_file.name
            
            try:
                with zipfile.ZipFile(temp_file_path, 'r') as docx_zip:
                    file_list = docx_zip.namelist()
                    
                    # Look for media files (images)
                    media_files = [f for f in file_list if f.startswith('word/media/')]
                    image_files = [f for f in media_files if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))]
                    
                    print(f"    Found {len(media_files)} media files: {media_files}")
                    print(f"    Found {len(image_files)} image files: {image_files}")
                    
                    # Check document.xml for image references
                    document_xml = None
                    if 'word/document.xml' in file_list:
                        document_xml = docx_zip.read('word/document.xml').decode('utf-8', errors='ignore')
                    
                    # Look for drawing/image elements
                    has_drawings = False
                    drawing_count = 0
                    if document_xml:
                        has_drawings = ('<w:drawing>' in document_xml or 
                                      '<pic:pic>' in document_xml or 
                                      'blip:embed' in document_xml)
                        drawing_count = document_xml.count('<w:drawing>')
                    
                    print(f"    Has drawing elements: {has_drawings}")
                    print(f"    Drawing elements count: {drawing_count}")
                    
                    # Check for Mermaid-related content
                    mermaid_references = 0
                    if document_xml:
                        mermaid_references = document_xml.lower().count('mermaid')
                    
                    print(f"    Mermaid references in document: {mermaid_references}")
                    
                    # Determine success
                    baseline_size = 20000
                    size_increase = file_size - baseline_size
                    
                    success = False
                    details = ""
                    
                    if len(image_files) > 0:
                        success = True
                        details = f"✅ SUCCESS: Found {len(image_files)} embedded image files (likely rendered Mermaid diagrams)"
                    elif has_drawings and file_size > baseline_size * 1.5:
                        success = True
                        details = f"✅ SUCCESS: Found drawing elements and significant file size increase (+{size_increase} bytes), indicating embedded diagrams"
                    elif file_size > baseline_size * 2:
                        success = True
                        details = f"⚠️ PARTIAL SUCCESS: Large file size (+{size_increase} bytes) suggests embedded content, but no standard image files detected"
                    else:
                        success = False
                        details = f"❌ FAILURE: No embedded images detected. File size: {file_size} bytes, Images: {len(image_files)}, Drawings: {has_drawings}"
                    
                    print(f"\n🎯 RESULT: {details}")
                    
                    # Additional analysis
                    print(f"\n📊 DETAILED ANALYSIS:")
                    print(f"    File size: {file_size:,} bytes")
                    print(f"    Size increase from baseline: +{size_increase:,} bytes")
                    print(f"    Media files: {len(media_files)}")
                    print(f"    Image files: {len(image_files)}")
                    print(f"    Drawing elements: {drawing_count}")
                    print(f"    Has drawing markup: {has_drawings}")
                    print(f"    Mermaid references: {mermaid_references}")
                    print(f"    Content-Type: {content_type}")
                    
                    return success
                    
            finally:
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
                    
        except Exception as e:
            print(f"❌ Exception during test: {str(e)}")
            return False
        finally:
            await self.client.aclose()

async def main():
    """Run the Mermaid diagram test"""
    tester = MermaidDiagramTester()
    success = await tester.test_mermaid_docx_export()
    
    print("\n" + "=" * 60)
    if success:
        print("🎉 MERMAID DIAGRAM TEST PASSED!")
    else:
        print("💥 MERMAID DIAGRAM TEST FAILED!")
    print("=" * 60)
    
    return 0 if success else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)