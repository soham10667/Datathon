function switchTab(tab) {
            const loginTab = document.getElementById('tabLogin');
            const regTab = document.getElementById('tabRegister');
            const loginForm = document.getElementById('loginForm');
            const regForm = document.getElementById('registerForm');
            const heading = document.getElementById('authHeading');
            const subheading = document.getElementById('authSubheading');

            if (tab === 'login') {
                loginTab.classList.add('active');
                regTab.classList.remove('active');
                loginForm.classList.add('active');
                regForm.classList.remove('active');
                heading.textContent = "Sign In";
                subheading.textContent = "Access your CrimeIntel AI portal";
            } else {
                regTab.classList.add('active');
                loginTab.classList.remove('active');
                regForm.classList.add('active');
                loginForm.classList.remove('active');
                heading.textContent = "Register Account";
                subheading.textContent = "Request new officer portal clearance";
            }
        }

        function handleLogin(e) {
            e.preventDefault();
            const badge = document.getElementById('badgeInput').value;
            showToast(`Sign in successful for ${badge}`, "success");
            setTimeout(() => { window.location.href = "index.html"; }, 600);
        }

        function handleRegister(e) {
            e.preventDefault();
            showToast("Registration request submitted successfully", "success");
            switchTab('login');
        }