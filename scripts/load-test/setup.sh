#!/bin/bash

# k6 Installation and Setup Script
# Installs k6 and verifies the environment for load testing

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
  echo -e "\n${BLUE}================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}================================${NC}\n"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_info() {
  echo -e "${YELLOW}ℹ $1${NC}"
}

# ============================================================================
# DETECT OS AND INSTALL K6
# ============================================================================

print_header "K6 LOAD TESTING - SETUP"

# Check if k6 is already installed
if command -v k6 &> /dev/null; then
    print_success "k6 already installed"
    k6 version
else
    print_info "Installing k6..."
    
    # Detect OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        print_info "Detected Linux"
        
        # Try apt first
        if command -v apt-get &> /dev/null; then
            echo "Installing k6 via apt..."
            sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69 2>/dev/null || true
            echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list > /dev/null 2>&1 || true
            sudo apt-get update
            sudo apt-get install -y k6
        # Try dnf (Fedora)
        elif command -v dnf &> /dev/null; then
            echo "Installing k6 via dnf..."
            sudo dnf install -y k6
        # Try pacman (Arch)
        elif command -v pacman &> /dev/null; then
            echo "Installing k6 via pacman..."
            sudo pacman -S k6
        else
            print_error "Unsupported package manager. Please install k6 manually from https://k6.io/docs/getting-started/installation/"
            exit 1
        fi
        
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        print_info "Detected macOS"
        
        if command -v brew &> /dev/null; then
            echo "Installing k6 via Homebrew..."
            brew install k6
        else
            print_error "Homebrew not found. Please install k6 from https://k6.io/docs/getting-started/installation/"
            exit 1
        fi
        
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        # Windows
        print_info "Detected Windows"
        
        if command -v choco &> /dev/null; then
            echo "Installing k6 via Chocolatey..."
            choco install k6
        else
            print_error "Chocolatey not found. Please install k6 manually from https://k6.io/docs/getting-started/installation/"
            exit 1
        fi
    else
        print_error "Unsupported OS. Please install k6 manually from https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
fi

print_success "k6 is ready"

# ============================================================================
# VERIFY ENVIRONMENT
# ============================================================================

print_header "ENVIRONMENT VERIFICATION"

# Check Node.js
if command -v node &> /dev/null; then
    print_success "Node.js $(node --version) installed"
else
    print_error "Node.js not found"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    print_success "npm $(npm --version) installed"
else
    print_error "npm not found"
    exit 1
fi

# Check PostgreSQL client
if command -v psql &> /dev/null; then
    print_success "PostgreSQL client installed"
else
    print_info "PostgreSQL client not found (optional but recommended)"
fi

# Check curl
if command -v curl &> /dev/null; then
    print_success "curl installed"
else
    print_error "curl not found"
    exit 1
fi

# ============================================================================
# CHECK SYSTEM LIMITS
# ============================================================================

print_header "SYSTEM LIMITS CHECK"

current_limit=$(ulimit -n)
print_info "Current file descriptor limit: $current_limit"

if [ "$current_limit" -lt "65535" ]; then
    print_info "Recommended limit for load testing: 65535"
    print_info "To increase, run:"
    echo "  ulimit -n 65535"
    echo "  or add 'ulimit -n 65535' to your shell profile"
else
    print_success "File descriptor limit is sufficient ($current_limit)"
fi

# ============================================================================
# SETUP PROJECT
# ============================================================================

print_header "PROJECT SETUP"

# Create directories
mkdir -p load-test-results
print_success "Created load-test-results directory"

mkdir -p scripts/load-test
print_success "Load test scripts directory ready"

# ============================================================================
# FINAL CHECKS
# ============================================================================

print_header "READINESS CHECK"

k6 version
echo ""

# Test k6 with simple script
print_info "Testing k6 with simple script..."
cat > /tmp/test-k6.js << 'EOFTEST'
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '5s', target: 10 },
    { duration: '5s', target: 0 },
  ],
};

export default function () {
  const res = http.get('http://www.example.com');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
EOFTEST

if k6 run /tmp/test-k6.js --summary-trend-stats=p(95),p(99) 2>/dev/null; then
    print_success "k6 is working correctly"
    rm /tmp/test-k6.js
else
    print_error "k6 test failed"
    rm /tmp/test-k6.js
    exit 1
fi

# ============================================================================
# SUMMARY
# ============================================================================

print_header "SETUP COMPLETE"

print_success "k6 load testing is ready to use"

echo ""
echo "Next steps:"
echo ""
echo "1. Start your application:"
echo "   npm run dev"
echo ""
echo "2. Run load tests:"
echo "   npm run load-test                    # Run all tests"
echo "   npm run load-test:sustained          # 2000 concurrent users"
echo "   npm run load-test:publish            # Publish burst"
echo "   npm run load-test:search             # Search burst"
echo "   npm run load-test:coldstart          # Cold start test"
echo ""
echo "3. Monitor database during load tests:"
echo "   node scripts/load-test/db-monitor.js"
echo ""
echo "4. Analyze results:"
echo "   npm run load-test:analyze"
echo ""
echo "For more info, see:"
echo "   docs/LOAD_TESTING_GUIDE.md"
echo ""
