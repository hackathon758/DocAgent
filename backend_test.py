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
BACKEND_URL = "https://prd-repair.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        self.auth_token = None
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
        """Run all backend tests for email-based authentication"""
        print(f"🚀 Starting Email-Based Authentication Tests")
        print(f"Backend URL: {self.base_url}")
        print(f"Test User: {self.test_user_email}")
        print("=" * 60)
        
        # Test basic API health first
        await self.test_health_check()
        
        # Test main authentication flow
        await self.test_user_registration()
        await self.test_user_login()
        await self.test_get_current_user()
        
        # Test error cases
        await self.test_duplicate_registration()
        await self.test_login_wrong_password()
        await self.test_me_without_token()
        await self.test_me_with_invalid_token()
        
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