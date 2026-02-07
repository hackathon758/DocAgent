#!/usr/bin/env python3
"""
Backend API Testing Suite for Email-Based Authentication
Tests the email authentication endpoints as requested in the review
"""

import asyncio
import httpx
import json
import uuid
from datetime import datetime
import sys
import os

# Get backend URL from frontend .env file
BACKEND_URL = "https://fullstack-makeover.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        self.auth_token = None
        self.job_id = None  # Store job_id for repository documentation tests
        # Use the exact test data from the review request
        self.test_user_email = "testuser@example.com"
        self.test_user_password = "TestPass123!"
        self.test_user_name = "Test User"

    async def log_result(self, test_name: str, success: bool, details: str = "", response_data: dict = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    Details: {details}")
        if not success and response_data:
            print(f"    Response: {json.dumps(response_data, indent=2)}")
        print()

    async def test_user_registration(self):
        """Test POST /api/auth/register - User Registration"""
        test_name = "User Registration (POST /api/auth/register)"
        try:
            user_data = {
                "email": self.test_user_email,
                "password": self.test_user_password,
                "name": self.test_user_name
            }
            
            response = await self.client.post(f"{self.base_url}/auth/register", json=user_data)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    self.auth_token = data["access_token"]
                    user = data["user"]
                    
                    # Verify user object structure
                    required_fields = ["id", "email", "name", "tenant_id", "role", "created_at"]
                    missing_fields = [field for field in required_fields if field not in user]
                    
                    if missing_fields:
                        await self.log_result(test_name, False, 
                            f"User object missing required fields: {missing_fields}", data)
                        return
                    
                    # Verify email matches
                    if user["email"] != self.test_user_email:
                        await self.log_result(test_name, False, 
                            f"Email mismatch. Expected: {self.test_user_email}, Got: {user['email']}", data)
                        return
                    
                    # Verify name matches
                    if user["name"] != self.test_user_name:
                        await self.log_result(test_name, False, 
                            f"Name mismatch. Expected: {self.test_user_name}, Got: {user['name']}", data)
                        return
                    
                    await self.log_result(test_name, True, 
                        f"User registered successfully: {user['email']}", 
                        {"user_id": user["id"], "email": user["email"], "name": user["name"]})
                else:
                    await self.log_result(test_name, False, "Missing access_token or user in response", data)
            elif response.status_code == 400:
                # Check if it's because user already exists
                data = response.json()
                if "already registered" in data.get("detail", "").lower():
                    await self.log_result(test_name, True, 
                        "User already exists - this is expected behavior for duplicate registration", data)
                else:
                    await self.log_result(test_name, False, 
                        f"HTTP 400 with unexpected error: {data.get('detail', 'Unknown error')}", data)
            else:
                await self.log_result(test_name, False, 
                    f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_user_login(self):
        """Test POST /api/auth/login - User Login"""
        test_name = "User Login (POST /api/auth/login)"
        try:
            login_data = {
                "email": self.test_user_email,
                "password": self.test_user_password
            }
            
            response = await self.client.post(f"{self.base_url}/auth/login", json=login_data)
            
            if response.status_code == 200:
                data = response.json()
                if "access_token" in data and "user" in data:
                    # Update token for subsequent tests
                    self.auth_token = data["access_token"]
                    user = data["user"]
                    
                    # Verify user object structure
                    required_fields = ["id", "email", "name", "tenant_id", "role", "created_at"]
                    missing_fields = [field for field in required_fields if field not in user]
                    
                    if missing_fields:
                        await self.log_result(test_name, False, 
                            f"User object missing required fields: {missing_fields}", data)
                        return
                    
                    # Verify email matches
                    if user["email"] != self.test_user_email:
                        await self.log_result(test_name, False, 
                            f"Email mismatch. Expected: {self.test_user_email}, Got: {user['email']}", data)
                        return
                    
                    await self.log_result(test_name, True, 
                        f"User logged in successfully: {user['email']}", 
                        {"user_id": user["id"], "email": user["email"], "name": user["name"]})
                else:
                    await self.log_result(test_name, False, "Missing access_token or user in response", data)
            else:
                await self.log_result(test_name, False, 
                    f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_get_current_user(self):
        """Test GET /api/auth/me - Get Current User"""
        test_name = "Get Current User (GET /api/auth/me)"
        try:
            if not self.auth_token:
                await self.log_result(test_name, False, "No auth token available - skipping test")
                return
            
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = await self.client.get(f"{self.base_url}/auth/me", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify required fields
                required_fields = ["id", "email", "name", "tenant_id", "role", "created_at"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    await self.log_result(test_name, False, 
                        f"Response missing required fields: {missing_fields}", data)
                    return
                
                # Verify email matches
                if data["email"] != self.test_user_email:
                    await self.log_result(test_name, False, 
                        f"Email mismatch. Expected: {self.test_user_email}, Got: {data['email']}", data)
                    return
                
                await self.log_result(test_name, True, 
                    f"Current user info retrieved: {data['email']}", 
                    {"user_id": data["id"], "email": data["email"], "name": data.get("name")})
            else:
                await self.log_result(test_name, False, 
                    f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_duplicate_registration(self):
        """Test registering with already existing email (should fail with 400)"""
        test_name = "Duplicate Registration Error (should return 400)"
        try:
            user_data = {
                "email": self.test_user_email,  # Same email as before
                "password": self.test_user_password,
                "name": "Another User"
            }
            
            response = await self.client.post(f"{self.base_url}/auth/register", json=user_data)
            
            if response.status_code == 400:
                data = response.json()
                if "already registered" in data.get("detail", "").lower() or "already" in data.get("detail", "").lower():
                    await self.log_result(test_name, True, 
                        f"Correctly rejected duplicate email with HTTP 400: {data.get('detail')}", data)
                else:
                    await self.log_result(test_name, False, 
                        f"HTTP 400 but unexpected error message: {data.get('detail')}", data)
            else:
                await self.log_result(test_name, False, 
                    f"Expected HTTP 400 for duplicate email, got HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_login_wrong_password(self):
        """Test logging in with wrong password (should fail with 401)"""
        test_name = "Login with Wrong Password (should return 401)"
        try:
            login_data = {
                "email": self.test_user_email,
                "password": "WrongPassword123!"  # Wrong password
            }
            
            response = await self.client.post(f"{self.base_url}/auth/login", json=login_data)
            
            if response.status_code == 401:
                data = response.json()
                await self.log_result(test_name, True, 
                    f"Correctly rejected wrong password with HTTP 401: {data.get('detail')}", data)
            else:
                await self.log_result(test_name, False, 
                    f"Expected HTTP 401 for wrong password, got HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_me_without_token(self):
        """Test accessing /api/auth/me without token (should fail with 401/403)"""
        test_name = "Access /me without Token (should return 401/403)"
        try:
            # No Authorization header
            response = await self.client.get(f"{self.base_url}/auth/me")
            
            if response.status_code in [401, 403]:
                data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"error": response.text}
                await self.log_result(test_name, True, 
                    f"Correctly rejected request without token with HTTP {response.status_code}", data)
            else:
                await self.log_result(test_name, False, 
                    f"Expected HTTP 401/403 for missing token, got HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_me_with_invalid_token(self):
        """Test accessing /api/auth/me with invalid token (should fail with 401)"""
        test_name = "Access /me with Invalid Token (should return 401)"
        try:
            headers = {"Authorization": "Bearer invalid_token_12345"}
            response = await self.client.get(f"{self.base_url}/auth/me", headers=headers)
            
            if response.status_code == 401:
                data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"error": response.text}
                await self.log_result(test_name, True, 
                    f"Correctly rejected invalid token with HTTP 401", data)
            else:
                await self.log_result(test_name, False, 
                    f"Expected HTTP 401 for invalid token, got HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_repo_documentation_start(self):
        """Test POST /api/repo-documentation/start - Start documentation job"""
        test_name = "Repository Documentation Start (POST /api/repo-documentation/start)"
        try:
            if not self.auth_token:
                await self.log_result(test_name, False, "No auth token available - skipping test")
                return
            
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            # Use a small test repository as suggested in the review request
            repo_data = {
                "repo_url": "https://github.com/sindresorhus/is",
                "branch": "main"
            }
            
            response = await self.client.post(f"{self.base_url}/repo-documentation/start", 
                                            json=repo_data, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify required fields in response
                required_fields = ["job_id", "total_files"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    await self.log_result(test_name, False, 
                        f"Response missing required fields: {missing_fields}", data)
                    return
                
                # Store job_id for subsequent tests
                self.job_id = data["job_id"]
                
                await self.log_result(test_name, True, 
                    f"Documentation job started successfully. Job ID: {data['job_id']}, Total files: {data['total_files']}", 
                    {"job_id": data["job_id"], "total_files": data["total_files"]})
            else:
                await self.log_result(test_name, False, 
                    f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_repo_documentation_status(self):
        """Test GET /api/repo-documentation/status/{job_id} - Get job status"""
        test_name = "Repository Documentation Status (GET /api/repo-documentation/status/{job_id})"
        try:
            if not self.auth_token:
                await self.log_result(test_name, False, "No auth token available - skipping test")
                return
            
            if not hasattr(self, 'job_id') or not self.job_id:
                await self.log_result(test_name, False, "No job_id available - skipping test")
                return
            
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = await self.client.get(f"{self.base_url}/repo-documentation/status/{self.job_id}", 
                                           headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify required fields in response
                required_fields = ["status", "current_agent", "agents", "files_processed", "total_files", "overall_progress"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    await self.log_result(test_name, False, 
                        f"Response missing required fields: {missing_fields}", data)
                    return
                
                # Verify agents structure
                if "agents" in data and isinstance(data["agents"], dict):
                    expected_agents = ["reader", "searcher", "writer", "verifier", "diagram"]
                    agents_data = data["agents"]
                    
                    # Check if at least some expected agents are present
                    found_agents = [agent for agent in expected_agents if agent in agents_data]
                    
                    await self.log_result(test_name, True, 
                        f"Job status retrieved successfully. Status: {data['status']}, Progress: {data['overall_progress']}%, Agents found: {found_agents}", 
                        {"status": data["status"], "overall_progress": data["overall_progress"], "agents_count": len(found_agents)})
                else:
                    await self.log_result(test_name, False, 
                        "Agents field is missing or not a dictionary", data)
            elif response.status_code == 404:
                await self.log_result(test_name, False, 
                    f"Job not found (HTTP 404) - this might indicate the job_id is invalid: {response.text}")
            else:
                await self.log_result(test_name, False, 
                    f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_repo_documentation_preview(self):
        """Test GET /api/repo-documentation/preview/{job_id} - Get documentation preview"""
        test_name = "Repository Documentation Preview (GET /api/repo-documentation/preview/{job_id})"
        try:
            if not self.auth_token:
                await self.log_result(test_name, False, "No auth token available - skipping test")
                return
            
            if not hasattr(self, 'job_id') or not self.job_id:
                await self.log_result(test_name, False, "No job_id available - skipping test")
                return
            
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = await self.client.get(f"{self.base_url}/repo-documentation/preview/{self.job_id}", 
                                           headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify response structure - should return JSON with documentation array
                if isinstance(data, dict) and "documentation" in data:
                    docs = data["documentation"]
                    if isinstance(docs, list):
                        await self.log_result(test_name, True, 
                            f"Documentation preview retrieved successfully. Found {len(docs)} documentation entries", 
                            {"documentation_count": len(docs)})
                    else:
                        await self.log_result(test_name, False, 
                            "Documentation field is not a list", data)
                elif isinstance(data, list):
                    # Direct array response
                    await self.log_result(test_name, True, 
                        f"Documentation preview retrieved successfully. Found {len(data)} documentation entries", 
                        {"documentation_count": len(data)})
                else:
                    await self.log_result(test_name, False, 
                        "Unexpected response format - expected JSON with documentation array", data)
            elif response.status_code == 404:
                await self.log_result(test_name, False, 
                    f"Job not found (HTTP 404) - this might indicate the job_id is invalid: {response.text}")
            else:
                await self.log_result(test_name, False, 
                    f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def wait_for_job_completion(self, job_id: str, max_wait_time: int = 300):
        """Wait for documentation job to complete, polling status endpoint"""
        if not self.auth_token:
            return False, "No auth token available"
        
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        start_time = asyncio.get_event_loop().time()
        
        while True:
            try:
                response = await self.client.get(f"{self.base_url}/repo-documentation/status/{job_id}", 
                                               headers=headers)
                
                if response.status_code == 200:
                    data = response.json()
                    status = data.get("status", "unknown")
                    progress = data.get("overall_progress", 0)
                    
                    print(f"    Job {job_id}: {status} - {progress}% complete")
                    
                    if status == "completed":
                        return True, "Job completed successfully"
                    elif status == "failed":
                        return False, f"Job failed: {data.get('error', 'Unknown error')}"
                    
                    # Check timeout
                    elapsed = asyncio.get_event_loop().time() - start_time
                    if elapsed > max_wait_time:
                        return False, f"Timeout after {max_wait_time} seconds"
                    
                    # Wait before next poll
                    await asyncio.sleep(5)
                else:
                    return False, f"Status check failed: HTTP {response.status_code}"
                    
            except Exception as e:
                return False, f"Exception during status check: {str(e)}"

    async def test_mermaid_diagram_docx_export(self):
        """Test DOCX export with rendered Mermaid diagrams - Main focus of review request"""
        test_name = "DOCX Export with Rendered Mermaid Diagrams"
        try:
            if not self.auth_token:
                await self.log_result(test_name, False, "No auth token available - skipping test")
                return
            
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            
            # Step 1: Start a new documentation job for sindresorhus/is repo
            print(f"    Step 1: Starting documentation job for https://github.com/sindresorhus/is")
            repo_data = {
                "repo_url": "https://github.com/sindresorhus/is",
                "branch": "main"
            }
            
            start_response = await self.client.post(f"{self.base_url}/repo-documentation/start", 
                                                  json=repo_data, headers=headers)
            
            if start_response.status_code != 200:
                await self.log_result(test_name, False, 
                    f"Failed to start documentation job: HTTP {start_response.status_code}: {start_response.text}")
                return
            
            start_data = start_response.json()
            job_id = start_data.get("job_id")
            total_files = start_data.get("total_files", 0)
            
            if not job_id:
                await self.log_result(test_name, False, "No job_id returned from start endpoint", start_data)
                return
            
            print(f"    Job started successfully: {job_id} (processing {total_files} files)")
            
            # Step 2: Wait for job completion by polling status endpoint
            print(f"    Step 2: Waiting for job completion (polling status endpoint)...")
            completed, message = await self.wait_for_job_completion(job_id, max_wait_time=300)
            
            if not completed:
                await self.log_result(test_name, False, f"Job did not complete: {message}")
                return
            
            print(f"    Job completed successfully!")
            
            # Step 3: Export DOCX and verify it contains embedded images
            print(f"    Step 3: Exporting DOCX and verifying Mermaid diagram rendering...")
            export_response = await self.client.get(f"{self.base_url}/repo-documentation/export/{job_id}", 
                                                  headers=headers)
            
            if export_response.status_code != 200:
                await self.log_result(test_name, False, 
                    f"DOCX export failed: HTTP {export_response.status_code}: {export_response.text}")
                return
            
            # Verify content type is DOCX
            content_type = export_response.headers.get("content-type", "")
            expected_content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            
            if content_type != expected_content_type:
                await self.log_result(test_name, False, 
                    f"Incorrect content-type. Expected: {expected_content_type}, Got: {content_type}")
                return
            
            # Get file size
            docx_content = export_response.content
            file_size = len(docx_content)
            
            if file_size == 0:
                await self.log_result(test_name, False, "DOCX file is empty (0 bytes)")
                return
            
            # Step 4: Analyze DOCX content for embedded images (diagrams)
            print(f"    Step 4: Analyzing DOCX content for embedded Mermaid diagrams...")
            
            # Save DOCX temporarily to analyze its contents
            import tempfile
            import zipfile
            import os
            
            with tempfile.NamedTemporaryFile(suffix='.docx', delete=False) as temp_file:
                temp_file.write(docx_content)
                temp_file_path = temp_file.name
            
            try:
                # DOCX files are ZIP archives - check for embedded images
                with zipfile.ZipFile(temp_file_path, 'r') as docx_zip:
                    file_list = docx_zip.namelist()
                    
                    # Look for media files (images) in the DOCX
                    media_files = [f for f in file_list if f.startswith('word/media/')]
                    image_files = [f for f in media_files if f.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))]
                    
                    # Check document.xml for image references
                    document_xml = None
                    if 'word/document.xml' in file_list:
                        document_xml = docx_zip.read('word/document.xml').decode('utf-8', errors='ignore')
                    
                    # Look for drawing/image elements in the XML
                    has_drawings = False
                    if document_xml:
                        has_drawings = ('<w:drawing>' in document_xml or 
                                      '<pic:pic>' in document_xml or 
                                      'blip:embed' in document_xml)
                    
                    # Calculate size comparison
                    baseline_size = 20000  # Approximate size of DOCX without images
                    size_increase = file_size - baseline_size
                    
                    # Determine if diagrams are embedded
                    diagrams_embedded = len(image_files) > 0 or has_drawings
                    
                    if diagrams_embedded:
                        await self.log_result(test_name, True, 
                            f"✅ DOCX export with Mermaid diagrams successful! Found {len(image_files)} image files, file size: {file_size} bytes (increase: +{size_increase} bytes), has drawing elements: {has_drawings}", 
                            {
                                "job_id": job_id,
                                "file_size": file_size,
                                "image_files_count": len(image_files),
                                "image_files": image_files,
                                "has_drawing_elements": has_drawings,
                                "size_increase": size_increase,
                                "content_type": content_type
                            })
                    else:
                        # Check if file size suggests images might be embedded differently
                        if file_size > baseline_size * 1.5:  # 50% larger than baseline
                            await self.log_result(test_name, True, 
                                f"⚠️ DOCX export completed with larger file size ({file_size} bytes), suggesting embedded content, but no standard image files detected. This might indicate a different embedding method.", 
                                {
                                    "job_id": job_id,
                                    "file_size": file_size,
                                    "image_files_count": len(image_files),
                                    "has_drawing_elements": has_drawings,
                                    "size_increase": size_increase,
                                    "content_type": content_type
                                })
                        else:
                            await self.log_result(test_name, False, 
                                f"❌ DOCX export completed but no embedded images detected. File size: {file_size} bytes, Image files: {len(image_files)}, Drawing elements: {has_drawings}", 
                                {
                                    "job_id": job_id,
                                    "file_size": file_size,
                                    "image_files_count": len(image_files),
                                    "image_files": image_files,
                                    "has_drawing_elements": has_drawings,
                                    "docx_files": file_list[:10]  # First 10 files for debugging
                                })
                
            finally:
                # Clean up temporary file
                try:
                    os.unlink(temp_file_path)
                except:
                    pass
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_repo_documentation_export(self):
        """Test GET /api/repo-documentation/export/{job_id} - Export DOCX file"""
        test_name = "Repository Documentation Export (GET /api/repo-documentation/export/{job_id})"
        try:
            if not self.auth_token:
                await self.log_result(test_name, False, "No auth token available - skipping test")
                return
            
            if not hasattr(self, 'job_id') or not self.job_id:
                await self.log_result(test_name, False, "No job_id available - skipping test")
                return
            
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = await self.client.get(f"{self.base_url}/repo-documentation/export/{self.job_id}", 
                                           headers=headers)
            
            if response.status_code == 200:
                # Verify content type is DOCX
                content_type = response.headers.get("content-type", "")
                expected_content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                
                if content_type == expected_content_type:
                    # Verify we got actual file content
                    content_length = len(response.content)
                    if content_length > 0:
                        await self.log_result(test_name, True, 
                            f"DOCX file exported successfully. Content-Type: {content_type}, Size: {content_length} bytes", 
                            {"content_type": content_type, "file_size": content_length})
                    else:
                        await self.log_result(test_name, False, 
                            "DOCX file is empty (0 bytes)")
                else:
                    await self.log_result(test_name, False, 
                        f"Incorrect content-type. Expected: {expected_content_type}, Got: {content_type}")
            elif response.status_code == 404:
                await self.log_result(test_name, False, 
                    f"Job not found (HTTP 404) - this might indicate the job_id is invalid: {response.text}")
            elif response.status_code == 400:
                # Job might not be completed yet
                data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"error": response.text}
                await self.log_result(test_name, False, 
                    f"Export not available (HTTP 400) - job might not be completed yet: {data}")
            else:
                await self.log_result(test_name, False, 
                    f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_repo_documentation_invalid_job_id(self):
        """Test repository documentation endpoints with invalid job_id"""
        test_name = "Repository Documentation with Invalid Job ID (should return 404)"
        try:
            if not self.auth_token:
                await self.log_result(test_name, False, "No auth token available - skipping test")
                return
            
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            invalid_job_id = "invalid-job-id-12345"
            
            # Test status endpoint with invalid job_id
            response = await self.client.get(f"{self.base_url}/repo-documentation/status/{invalid_job_id}", 
                                           headers=headers)
            
            if response.status_code == 404:
                await self.log_result(test_name, True, 
                    f"Correctly returned HTTP 404 for invalid job_id: {invalid_job_id}")
            else:
                await self.log_result(test_name, False, 
                    f"Expected HTTP 404 for invalid job_id, got HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_repo_documentation_invalid_repo_url(self):
        """Test starting documentation with invalid repository URL"""
        test_name = "Repository Documentation Start with Invalid URL (should return error)"
        try:
            if not self.auth_token:
                await self.log_result(test_name, False, "No auth token available - skipping test")
                return
            
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            # Use an invalid repository URL
            repo_data = {
                "repo_url": "https://github.com/nonexistent/repository-that-does-not-exist",
                "branch": "main"
            }
            
            response = await self.client.post(f"{self.base_url}/repo-documentation/start", 
                                            json=repo_data, headers=headers)
            
            if response.status_code in [400, 404]:
                data = response.json() if response.headers.get("content-type", "").startswith("application/json") else {"error": response.text}
                await self.log_result(test_name, True, 
                    f"Correctly rejected invalid repository URL with HTTP {response.status_code}", data)
            else:
                await self.log_result(test_name, False, 
                    f"Expected HTTP 400/404 for invalid repository URL, got HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_models_endpoint(self):
        """Test GET /api/models - Verify agent model assignments"""
        test_name = "AI Models Configuration (GET /api/models)"
        try:
            response = await self.client.get(f"{self.base_url}/models")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify agent_assignments structure
                if "agent_assignments" not in data:
                    await self.log_result(test_name, False, "Missing agent_assignments in response", data)
                    return
                
                assignments = data["agent_assignments"]
                
                # Expected model assignments from the review request
                expected_assignments = {
                    "reader": "Salesforce/codet5p-16b",
                    "searcher": "Qwen/Qwen2.5-Coder-7B-Instruct", 
                    "writer": "bigcode/starcoder2-15b-instruct-v0.1",
                    "verifier": "meta-llama/Meta-Llama-3.1-8B-Instruct",
                    "diagram": "meta-llama/Meta-Llama-3.1-8B-Instruct"
                }
                
                # Verify each assignment
                mismatches = []
                for agent, expected_model in expected_assignments.items():
                    if agent not in assignments:
                        mismatches.append(f"Missing agent: {agent}")
                    elif assignments[agent] != expected_model:
                        mismatches.append(f"{agent}: expected '{expected_model}', got '{assignments[agent]}'")
                
                if mismatches:
                    await self.log_result(test_name, False, 
                        f"Agent model assignment mismatches: {'; '.join(mismatches)}", 
                        {"expected": expected_assignments, "actual": assignments})
                else:
                    await self.log_result(test_name, True, 
                        "All agent model assignments are correct", 
                        {"assignments": assignments})
                        
            else:
                await self.log_result(test_name, False, 
                    f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_models_status_endpoint(self):
        """Test GET /api/models/status - Verify Bytez API configuration"""
        test_name = "AI Models Status (GET /api/models/status)"
        try:
            response = await self.client.get(f"{self.base_url}/models/status")
            
            if response.status_code == 200:
                data = response.json()
                
                # Verify required fields
                required_fields = ["bytez_configured", "bytez_api_url", "models_available"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    await self.log_result(test_name, False, 
                        f"Response missing required fields: {missing_fields}", data)
                    return
                
                # Verify Bytez configuration
                if not data.get("bytez_configured"):
                    await self.log_result(test_name, False, 
                        "Bytez API is not configured", data)
                    return
                
                if not data.get("models_available"):
                    await self.log_result(test_name, False, 
                        "Models are not available", data)
                    return
                
                await self.log_result(test_name, True, 
                    f"Bytez API configured and models available. API URL: {data.get('bytez_api_url')}", 
                    {"bytez_configured": data["bytez_configured"], "models_available": data["models_available"]})
                        
            else:
                await self.log_result(test_name, False, 
                    f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_repo_documentation_with_model_verification(self):
        """Test repository documentation with focus on agent model usage"""
        test_name = "Repository Documentation with Model Verification"
        try:
            if not self.auth_token:
                await self.log_result(test_name, False, "No auth token available - skipping test")
                return
            
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            # Use the specific repo from review request
            repo_data = {
                "repo_url": "https://github.com/sindresorhus/is",
                "branch": "main"
            }
            
            # Start documentation job
            response = await self.client.post(f"{self.base_url}/repo-documentation/start", 
                                            json=repo_data, headers=headers)
            
            if response.status_code != 200:
                await self.log_result(test_name, False, 
                    f"Failed to start documentation job: HTTP {response.status_code}: {response.text}")
                return
            
            data = response.json()
            job_id = data.get("job_id")
            
            if not job_id:
                await self.log_result(test_name, False, "No job_id returned from start endpoint", data)
                return
            
            # Wait a moment for job to initialize
            await asyncio.sleep(3)
            
            # Check status to verify agent progress with new model names
            status_response = await self.client.get(f"{self.base_url}/repo-documentation/status/{job_id}", 
                                                  headers=headers)
            
            if status_response.status_code == 200:
                status_data = status_response.json()
                
                # Verify agents are present and have expected structure
                if "agents" not in status_data:
                    await self.log_result(test_name, False, "No agents field in status response", status_data)
                    return
                
                agents = status_data["agents"]
                expected_agents = ["reader", "searcher", "writer", "verifier", "diagram"]
                found_agents = [agent for agent in expected_agents if agent in agents]
                
                if len(found_agents) < 3:  # At least some agents should be present
                    await self.log_result(test_name, False, 
                        f"Expected at least 3 agents, found only: {found_agents}", status_data)
                    return
                
                # Verify current_agent field exists
                if "current_agent" not in status_data:
                    await self.log_result(test_name, False, "No current_agent field in status response", status_data)
                    return
                
                await self.log_result(test_name, True, 
                    f"Documentation job running with new model configuration. Current agent: {status_data.get('current_agent')}, Active agents: {found_agents}", 
                    {"job_id": job_id, "current_agent": status_data.get("current_agent"), "agents_found": found_agents})
                    
                # Store this job_id for other tests if not already set
                if not hasattr(self, 'job_id') or not self.job_id:
                    self.job_id = job_id
                    
            else:
                await self.log_result(test_name, False, 
                    f"Failed to get job status: HTTP {status_response.status_code}: {status_response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_health_check(self):
        """Test basic API health"""
        test_name = "API Health Check"
        try:
            response = await self.client.get(f"{self.base_url}/health")
            
            if response.status_code == 200:
                data = response.json()
                await self.log_result(test_name, True, "API is healthy", data)
            else:
                await self.log_result(test_name, False, 
                    f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def run_all_tests(self):
        """Run all backend tests for email-based authentication and repository documentation"""
        print(f"🚀 Starting Backend API Tests")
        print(f"Backend URL: {self.base_url}")
        print(f"Test User: {self.test_user_email}")
        print("=" * 60)
        
        # Test basic API health first
        await self.test_health_check()
        
        # Test AI Models Configuration (NEW - from review request)
        print("\n🤖 Testing AI Models Configuration...")
        await self.test_models_endpoint()
        await self.test_models_status_endpoint()
        
        # Test main authentication flow
        print("\n🔐 Testing Authentication...")
        await self.test_user_registration()
        await self.test_user_login()
        await self.test_get_current_user()
        
        # Test error cases for authentication
        await self.test_duplicate_registration()
        await self.test_login_wrong_password()
        await self.test_me_without_token()
        await self.test_me_with_invalid_token()
        
        # MAIN TEST: DOCX Export with Rendered Mermaid Diagrams (from review request)
        print("\n🎨 Testing DOCX Export with Rendered Mermaid Diagrams...")
        await self.test_mermaid_diagram_docx_export()
        
        # Test repository documentation endpoints (requires authentication)
        print("\n📚 Testing Repository Documentation Endpoints...")
        await self.test_repo_documentation_with_model_verification()  # NEW - focuses on model verification
        
        # Wait a moment for job to initialize before checking status
        if hasattr(self, 'job_id') and self.job_id:
            import asyncio
            await asyncio.sleep(2)  # Give the job a moment to start
        
        await self.test_repo_documentation_status()
        await self.test_repo_documentation_preview()
        await self.test_repo_documentation_export()
        
        # Test error cases for repository documentation
        await self.test_repo_documentation_invalid_job_id()
        await self.test_repo_documentation_invalid_repo_url()
        
        # Summary
        print("=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        print("\n📋 DETAILED RESULTS:")
        for result in self.test_results:
            status = "✅ PASS" if result["success"] else "❌ FAIL"
            print(f"  {status} {result['test']}")
            if result["details"]:
                print(f"      {result['details']}")
        
        await self.client.aclose()
        return self.test_results

async def main():
    """Main test runner"""
    tester = BackendTester()
    results = await tester.run_all_tests()
    
    # Return exit code based on test results
    failed_count = sum(1 for r in results if not r["success"])
    return failed_count

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(min(exit_code, 1))  # Exit with 1 if any tests failed, 0 if all passed