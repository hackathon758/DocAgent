#!/usr/bin/env python3
"""
Backend API Testing Suite for GitHub OAuth Implementation
Tests the GitHub OAuth endpoints and existing authentication functionality
"""

import asyncio
import httpx
import json
import uuid
from datetime import datetime
import sys
import os

# Get backend URL from frontend .env file
BACKEND_URL = "https://github-auth-tester.preview.emergentagent.com/api"

class BackendTester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        self.auth_token = None
        self.test_user_email = f"test_user_{uuid.uuid4().hex[:8]}@example.com"
        self.test_user_password = "TestPassword123!"
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

    async def test_github_oauth_url_generation(self):
        """Test GET /api/auth/oauth/github endpoint"""
        test_name = "GitHub OAuth URL Generation"
        try:
            response = await self.client.get(f"{self.base_url}/auth/oauth/github")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if response has URL
                if "url" not in data:
                    await self.log_result(test_name, False, "Response missing 'url' field", data)
                    return
                
                url = data["url"]
                
                # Check if URL contains expected client_id
                expected_client_id = "Ov23li3nveyH7v7glUth"
                if expected_client_id not in url:
                    await self.log_result(test_name, False, 
                        f"URL does not contain expected client_id '{expected_client_id}'. URL: {url}", data)
                    return
                
                # Check if URL contains expected scopes
                expected_scopes = ["user:email", "read:user"]
                missing_scopes = []
                for scope in expected_scopes:
                    if scope not in url:
                        missing_scopes.append(scope)
                
                if missing_scopes:
                    await self.log_result(test_name, False, 
                        f"URL missing expected scopes: {missing_scopes}. URL: {url}", data)
                    return
                
                # Check if it's a proper GitHub OAuth URL
                if not url.startswith("https://github.com/login/oauth/authorize"):
                    await self.log_result(test_name, False, 
                        f"URL is not a proper GitHub OAuth URL. Expected to start with 'https://github.com/login/oauth/authorize', got: {url}", data)
                    return
                
                await self.log_result(test_name, True, f"Valid GitHub OAuth URL generated: {url}", data)
            else:
                await self.log_result(test_name, False, 
                    f"HTTP {response.status_code}: {response.text}", {"status_code": response.status_code})
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_github_oauth_callback_invalid_code(self):
        """Test POST /api/auth/oauth/github/callback with invalid code"""
        test_name = "GitHub OAuth Callback - Invalid Code"
        try:
            # Test with invalid code
            invalid_code = "invalid_test_code_12345"
            response = await self.client.post(
                f"{self.base_url}/auth/oauth/github/callback",
                json={"code": invalid_code}
            )
            
            # Should return an error for invalid code
            if response.status_code in [400, 401, 422]:
                data = response.json()
                if "error" in data or "detail" in data:
                    await self.log_result(test_name, True, 
                        f"Properly handled invalid code with HTTP {response.status_code}", data)
                else:
                    await self.log_result(test_name, False, 
                        f"HTTP {response.status_code} but no error message in response", data)
            elif response.status_code == 200:
                # If it returns 200, it might be mocked - check if it's creating a real user or mock user
                data = response.json()
                if "access_token" in data and "user" in data:
                    user_email = data["user"].get("email", "")
                    if "github_user_" in user_email or "mock" in user_email.lower():
                        await self.log_result(test_name, False, 
                            "Endpoint is MOCKED - returns success for invalid code and creates mock user", data)
                    else:
                        await self.log_result(test_name, False, 
                            "Endpoint returned success (200) for invalid code - should return error", data)
                else:
                    await self.log_result(test_name, False, 
                        f"Unexpected response format for HTTP 200", data)
            else:
                await self.log_result(test_name, False, 
                    f"Unexpected HTTP status {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_user_registration(self):
        """Test POST /api/auth/register"""
        test_name = "User Registration"
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
                    await self.log_result(test_name, True, 
                        f"User registered successfully: {data['user']['email']}", 
                        {"user_id": data["user"]["id"], "email": data["user"]["email"]})
                else:
                    await self.log_result(test_name, False, "Missing access_token or user in response", data)
            else:
                await self.log_result(test_name, False, 
                    f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_user_login(self):
        """Test POST /api/auth/login"""
        test_name = "User Login"
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
                    await self.log_result(test_name, True, 
                        f"User logged in successfully: {data['user']['email']}", 
                        {"user_id": data["user"]["id"], "email": data["user"]["email"]})
                else:
                    await self.log_result(test_name, False, "Missing access_token or user in response", data)
            else:
                await self.log_result(test_name, False, 
                    f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            await self.log_result(test_name, False, f"Exception: {str(e)}")

    async def test_get_current_user(self):
        """Test GET /api/auth/me"""
        test_name = "Get Current User Info"
        try:
            if not self.auth_token:
                await self.log_result(test_name, False, "No auth token available - skipping test")
                return
            
            headers = {"Authorization": f"Bearer {self.auth_token}"}
            response = await self.client.get(f"{self.base_url}/auth/me", headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "email" in data and data["email"] == self.test_user_email:
                    await self.log_result(test_name, True, 
                        f"Current user info retrieved: {data['email']}", 
                        {"user_id": data["id"], "email": data["email"], "name": data.get("name")})
                else:
                    await self.log_result(test_name, False, "Invalid user data in response", data)
            else:
                await self.log_result(test_name, False, 
                    f"HTTP {response.status_code}: {response.text}")
                
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
        """Run all backend tests"""
        print(f"🚀 Starting Backend API Tests")
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        
        # Test GitHub OAuth endpoints
        await self.test_github_oauth_url_generation()
        await self.test_github_oauth_callback_invalid_code()
        
        # Test existing auth endpoints
        await self.test_health_check()
        await self.test_user_registration()
        await self.test_user_login()
        await self.test_get_current_user()
        
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