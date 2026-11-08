
const STORAGE_KEY = "userName";
const ACCOUNTS_KEY = "lavenderAccounts";
const SESSION_KEY = "lavenderCurrentUser";
const NOTIFICATIONS_KEY = "lavenderNotifications";

const DB_NAME = "ProjectLavenderDB";
const DB_VERSION = 2;

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const $ = id => document.getElementById(id);

let orders = [];
let notifications = [];

function getAccounts() {
    try {
        return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || [];
    } catch (error) {
        console.error("Unable to load accounts:", error);
        return [];
    }
}

function saveAccounts(accounts) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
    } catch (error) {
        console.error("Unable to load current user:", error);
        return null;
    }
}

function setCurrentUser(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEY, user.fullName || "Student");
}

function getStudentName() {
    const user = getCurrentUser();

    return user?.fullName ||
        localStorage.getItem(STORAGE_KEY) ||
        "Student";
}

function getStudentId() {
    return getCurrentUser()?.studentId || "";
}

function updateStudentName() {
    const user = getCurrentUser();
    const name = getStudentName();

    document.querySelectorAll(
        "#studentName, #userName, #profileName"
    ).forEach(element => {
        element.textContent = name;
    });

    document.querySelectorAll(".student-avatar").forEach(element => {
        element.textContent = name.charAt(0).toUpperCase();
    });

    const avatar = $("profileAvatar");
    const username = $("profileUserName");
    const fullName = $("profileFullName");
    const studentId = $("profileStudentId");
    const accountStatus = $("profileAccountStatus");
    const statusDot = $("statusDot");

    if (username) {
        username.textContent = user?.username || "Not set";
    }

    if (fullName) {
        fullName.textContent = user?.fullName || "Student";
    }

    if (avatar) {
        avatar.textContent = name.charAt(0).toUpperCase();
    }

    if (studentId) {
        studentId.textContent = user?.studentId || "Not registered";
    }

    if (accountStatus) {
        accountStatus.textContent = user ? "Online" : "Offline";
    }

    if (statusDot) {
        statusDot.classList.toggle("online", !!user);
    }
}

function showMessage(element, message, type = "") {
    if (!element) return;

    element.textContent = message;
    element.classList.remove("success", "fail");

    if (type) {
        element.classList.add(type);
    }
}

function setUpWelcomeForm() {
    const form = $("welcomeForm");

    if (!form) return;

    if ($("registerPassword")) {
        form.addEventListener("submit", event => {
            event.preventDefault();

            const username = $("username").value.trim();
            const fullName = $("fullName").value.trim();
            const studentId = $("studentId").value.trim();
            const password = $("registerPassword").value;
            const confirmPassword = $("confirmPassword").value;

            if (!username || !fullName || !studentId ||
                !password || !confirmPassword) {
                alert("Please complete all fields.");
                return;
            }

            if (password.length < 8) {
                alert("Password must contain at least 8 characters.");
                $("registerPassword").focus();
                return;
            }

            if (password !== confirmPassword) {
                alert("Passwords do not match.");
                $("confirmPassword").focus();
                return;
            }

            const accounts = getAccounts();

            const existingUsername = accounts.find(account =>
                String(account.username || "").toLowerCase() ===
                username.toLowerCase()
            );

            if (existingUsername) {
                alert("This username is already taken.");
                $("username").focus();
                return;
            }

            const existingStudentId = accounts.find(account =>
                String(account.studentId || "").toLowerCase() ===
                studentId.toLowerCase()
            );

            if (existingStudentId) {
                alert("This Student ID is already registered.");
                $("studentId").focus();
                return;
            }

            const newAccount = {
                username,
                fullName,
                studentId,
                password
            };

            accounts.push(newAccount);

            try {
                saveAccounts(accounts);
                alert("Registration successful! You can now log in.");
                window.location.href = "index.html";
            } catch (error) {
                console.error("Registration failed:", error);
                alert("Unable to create your account. Please try again.");
            }
        });

        return;
    }

    if ($("username") && $("password")) {
        form.addEventListener("submit", event => {
            event.preventDefault();

            const username = $("username").value.trim();
            const password = $("password").value;

            const accounts = getAccounts();

            const account = accounts.find(item =>
                String(item.username || item.studentId || "").toLowerCase() ===
                username.toLowerCase() &&
                item.password === password
            );

            if (!account) {
                alert("Incorrect username or password.");
                return;
            }

            setCurrentUser(account);
            window.location.href = "my_order.html";
        });

        return;
    }

    if ($("name")) {
        const input = $("name");
        const user = getCurrentUser();

        if (user) {
            input.value = user.fullName || "";
        }

        form.addEventListener("submit", event => {
            event.preventDefault();

            const name = input.value.trim();

            if (!name) {
                alert("Please enter your name.");
                input.focus();
                return;
            }

            const currentUser = getCurrentUser();

            if (currentUser) {
                currentUser.fullName = name;

                const accounts = getAccounts();

                const index = accounts.findIndex(account =>
                    account.studentId === currentUser.studentId
                );

                if (index !== -1) {
                    accounts[index].fullName = name;
                    saveAccounts(accounts);
                }

                setCurrentUser(currentUser);
                updateStudentName();
            } else {
                localStorage.setItem(STORAGE_KEY, name);
            }

            window.location.href = "my_order.html";
        });
    }
}

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = event => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains("orders")) {
                db.createObjectStore("orders", {
                    keyPath: "id"
                });
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

async function saveOrder(order) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction("orders", "readwrite");

        transaction.objectStore("orders").put(order);

        transaction.oncomplete = () => {
            db.close();
            resolve();
        };

        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };

        transaction.onabort = () => {
            db.close();
            reject(transaction.error);
        };
    });
}

async function getAllOrders() {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction("orders", "readonly");
        const request = transaction.objectStore("orders").getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };

        transaction.oncomplete = () => {
            db.close();
        };

        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };
    });
}

async function deleteOrder(orderId) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction("orders", "readwrite");

        transaction.objectStore("orders").delete(orderId);

        transaction.oncomplete = () => {
            db.close();
            resolve();
        };

        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };

        transaction.onabort = () => {
            db.close();
            reject(transaction.error);
        };
    });
}

function getStudentOrders(allOrders) {
    const studentId = getStudentId();

    if (!studentId) return [];

    return allOrders.filter(order =>
        order.studentId === studentId
    );
}

function makeOrderNumber() {
    const randomPart = crypto.randomUUID
        ? crypto.randomUUID().replaceAll("-", "").slice(0, 10)
        : Math.random().toString(36).slice(2, 12);

    return `PL-${randomPart.toUpperCase()}`;
}

async function loadOrders() {
    const tbody = $("recentOrders");

    if (!tbody) return;

    showTableMessage(tbody, "Loading orders...");

    try {
        const allOrders = await getAllOrders();

        orders = getStudentOrders(allOrders);

        updateOrderSummary(orders);
        renderRecentOrders();
    } catch (error) {
        console.error("Unable to load orders:", error);
        showTableMessage(tbody, "Unable to load orders.");
        updateOrderSummary([]);
    }
}

function updateOrderSummary(orderList) {
    const total = $("totalOrders");
    const pending = $("pendingOrders");

    if (total) {
        total.textContent = orderList.length;
    }

    if (pending) {
        pending.textContent = orderList.filter(order =>
            ["Order Submitted", "Processing"].includes(order.status)
        ).length;
    }
}

function showTableMessage(tbody, message) {
    if (!tbody) return;

    tbody.replaceChildren();

    const row = tbody.insertRow();
    const cell = row.insertCell();

    cell.colSpan = 5;
    cell.className = "empty-state";
    cell.textContent = message;
}

function renderRecentOrders() {
    const tbody = $("recentOrders");

    if (!tbody) return;

    tbody.replaceChildren();

    const recentOrders = [...orders]
        .sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        )
        .slice(0, 5);

    if (!recentOrders.length) {
        showTableMessage(tbody, "You have no orders yet.");
        return;
    }

    recentOrders.forEach(order => {
        const row = tbody.insertRow();

        const checkboxCell = row.insertCell();
        const checkbox = document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.className = "select-order";
        checkbox.dataset.orderId = order.id;
        checkbox.setAttribute("aria-label", `Select order ${order.id}`);

        checkboxCell.appendChild(checkbox);

        [
            order.id,
            order.type,
            order.copies,
            order.status
        ].forEach(value => {
            row.insertCell().textContent = String(value ?? "");
        });
    });
}

function setUpOrderForm() {
    const form = $("orderForm");

    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const result = $("orderResult");
        const fileInput = $("file");
        const copiesInput = $("copies");
        const user = getCurrentUser();

        if (!user) {
            showMessage(result, "Please log in before placing an order.", "fail");
            return;
        }

        const file = fileInput?.files[0];
        const copies = Number(copiesInput?.value);

        if (!Number.isInteger(copies) || copies < 1 || copies > 10000) {
            showMessage(result, "Enter a whole number between 1 and 10,000.", "fail");
            copiesInput?.focus();
            return;
        }

        if (!file) {
            showMessage(result, "Please select a file.", "fail");
            fileInput?.focus();
            return;
        }

        const allowedTypes = [
            "application/pdf",
            "image/jpeg",
            "image/png"
        ];

        const allowedExtensions = [
            ".pdf",
            ".jpg",
            ".jpeg",
            ".png"
        ];

        const extension = file.name
            .slice(file.name.lastIndexOf("."))
            .toLowerCase();

        if (
            !allowedTypes.includes(file.type) &&
            !allowedExtensions.includes(extension)
        ) {
            showMessage(result, "Only PDF, JPG, JPEG, and PNG files are allowed.", "fail");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            showMessage(result, "Your file must not exceed 10 MB.", "fail");
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Submitting...";
        }

        showMessage(result, "Saving your order...");

        try {
            const orderNumber = makeOrderNumber();

            const order = {
                id: orderNumber,
                studentId: user.studentId,
                studentName: user.fullName,
                type: $("orderType")?.value || "",
                paperSize: $("paperSize")?.value || "",
                copies,
                color: $("color")?.value || "",
                fileName: file.name,
                file,
                status: "Order Submitted",
                createdAt: new Date().toISOString()
            };

            await saveOrder(order);

            addNotification(
                `Your order ${orderNumber} has been submitted successfully.`
            );

            showMessage(
                result,
                `Order submitted successfully! Order number: ${orderNumber}`,
                "success"
            );

            form.reset();

            await loadOrders();
        } catch (error) {
            console.error("Order submission failed:", error);
            showMessage(result, "Unable to save your order. Please try again.", "fail");
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = "Place Order";
            }
        }
    });
}

function setUpStatusForm() {
    const form = $("statusForm");

    if (!form) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const number = $("orderNumber")?.value.trim().toUpperCase();
        const result = $("statusResult");

        if (!number) {
            showMessage(result, "Enter your order number.", "fail");
            return;
        }

        try {
            const allOrders = await getAllOrders();
            const studentOrders = getStudentOrders(allOrders);

            const found = studentOrders.find(order =>
                String(order.id).toUpperCase() === number
            );

            if (!found) {
                showMessage(result, "No order found with that number.", "fail");
                return;
            }

            showMessage(
                result,
                `Order: ${found.id}\n` +
                `Type: ${found.type}\n` +
                `Paper Size: ${found.paperSize}\n` +
                `Copies: ${found.copies}\n` +
                `Color: ${found.color}\n` +
                `Status: ${found.status}\n` +
                `File: ${found.fileName}\n` +
                `Date: ${new Date(found.createdAt).toLocaleString()}`
            );
        } catch (error) {
            console.error("Status check failed:", error);
            showMessage(result, "Unable to check order status.", "fail");
        }
    });
}

function updateProfileDisplay(user) {
    if (!user) return;

    if ($("profileUserName")) {
        $("profileUserName").textContent = user.username || "Not set";
    }

    if ($("profileFullName")) {
        $("profileFullName").textContent = user.fullName || "Student";
    }

    if ($("profileStudentId")) {
        $("profileStudentId").textContent = user.studentId || "Not registered";
    }

    if ($("profileName")) {
        $("profileName").textContent = user.fullName || "Student";
    }

    if ($("profileAvatar")) {
        $("profileAvatar").textContent =
            (user.fullName || "S").charAt(0).toUpperCase();
    }
}

function setUpProfile() {
    const user = getCurrentUser();

    updateProfileDisplay(user);

    const button = $("changeName");

    if (!button) return;

    button.addEventListener("click", () => {
        const currentUser = getCurrentUser();

        if (!currentUser) {
            alert("Please log in first.");
            return;
        }

        const nextName = prompt(
            "Enter your new full name:",
            currentUser.fullName || ""
        );

        if (nextName === null) return;

        const name = nextName.trim();

        if (!name) {
            alert("Full name cannot be empty.");
            return;
        }

        const accounts = getAccounts();

        const index = accounts.findIndex(account =>
            account.studentId === currentUser.studentId
        );

        if (index === -1) {
            alert("Account not found.");
            return;
        }

        currentUser.fullName = name;
        accounts[index].fullName = name;

        saveAccounts(accounts);
        setCurrentUser(currentUser);

        updateProfileDisplay(currentUser);
        updateStudentName();

        alert("Your profile has been updated.");
    });
}

function setUpDeleteButton() {
    const button = $("deleteSelectedBtn");

    if (!button) return;

    button.addEventListener("click", async () => {
        const selected = document.querySelectorAll(
            "#recentOrders .select-order:checked"
        );

        if (!selected.length) {
            alert("Please select an order first.");
            return;
        }

        const confirmed = confirm(
            `Are you sure you want to delete ${selected.length} selected order(s)?`
        );

        if (!confirmed) return;

        button.disabled = true;
        button.textContent = "Deleting...";

        try {
            for (const checkbox of selected) {
                const orderId = checkbox.dataset.orderId;
                const order = orders.find(item => item.id === orderId);

                if (order && order.studentId === getStudentId()) {
                    await deleteOrder(orderId);
                }
            }

            alert("Selected orders deleted successfully.");
            await loadOrders();
        } catch (error) {
            console.error("Delete failed:", error);
            alert("Unable to delete selected orders.");
            await loadOrders();
        } finally {
            button.disabled = false;
            button.textContent = "Delete Selected";
        }
    });
}

function getNotifications() {
    try {
        return JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY)) || [];
    } catch (error) {
        console.error("Unable to load notifications:", error);
        return [];
    }
}

function saveNotifications() {
    localStorage.setItem(
        NOTIFICATIONS_KEY,
        JSON.stringify(notifications)
    );
}

function addNotification(message) {
    notifications = getNotifications();

    notifications.unshift({
        id: Date.now() + Math.random(),
        studentId: getStudentId(),
        message,
        is_read: false,
        created_at: new Date().toISOString()
    });

    saveNotifications();
    renderNotifications();
}

function loadNotifications() {
    notifications = getNotifications().filter(notification =>
        notification.studentId === getStudentId()
    );

    renderNotifications();

    const notificationList = $("notificationList");

    if (notificationList && !getCurrentUser()) {
        notificationList.textContent = "Please log in to view notifications.";
    }
}

function renderNotifications() {
    const notificationList = $("notificationList");
    const notificationCount = $("notificationCount");

    const studentNotifications = notifications.filter(notification =>
        notification.studentId === getStudentId()
    );

    const unreadCount = studentNotifications.filter(
        notification => !notification.is_read
    ).length;

    if (notificationCount) {
        notificationCount.textContent = unreadCount;
        notificationCount.hidden = unreadCount === 0;
    }

    if (!notificationList) return;

    notificationList.replaceChildren();

    if (!studentNotifications.length) {
        const message = document.createElement("p");
        message.textContent = "No notifications yet.";
        notificationList.appendChild(message);
        return;
    }

    studentNotifications.forEach(notification => {
        const item = document.createElement("div");

        item.className = notification.is_read
            ? "notification-item read"
            : "notification-item unread";

        const message = document.createElement("p");
        message.textContent = notification.message;

        const date = document.createElement("small");
        date.textContent = notification.created_at
            ? new Date(notification.created_at).toLocaleString()
            : "";

        item.append(message, date);

        if (!notification.is_read) {
            item.addEventListener("click", () => {
                markNotificationRead(notification.id);
            });
        }

        notificationList.appendChild(item);
    });
}

function markNotificationRead(notificationId) {
    const allNotifications = getNotifications();

    const notification = allNotifications.find(item =>
        item.id === notificationId
    );

    if (!notification) return;

    notification.is_read = true;

    localStorage.setItem(
        NOTIFICATIONS_KEY,
        JSON.stringify(allNotifications)
    );

    notifications = allNotifications.filter(item =>
        item.studentId === getStudentId()
    );

    renderNotifications();
}

function setUpNotifications() {
    const button = $("notificationBtn");
    const panel = $("notificationPanel");

    if (button && panel) {
        button.addEventListener("click", event => {
            event.stopPropagation();
            panel.hidden = !panel.hidden;
        });

        panel.addEventListener("click", event => {
            event.stopPropagation();
        });

        document.addEventListener("click", () => {
            panel.hidden = true;
        });
    }

    if ($("notificationList")) {
        loadNotifications();
    }
}

function setUpBackButton() {
    const backButton = $("back-button");

    if (!backButton) return;

    backButton.addEventListener("click", () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = "index.html";
        }
    });
}

function setUpLogout() {
    const logoutBtn = $("logoutBtn");

    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", () => {
        const confirmLogout = confirm(
            "Are you sure you want to log out?"
        );

        if (!confirmLogout) return;

        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(STORAGE_KEY);

        window.location.href = "index.html";
    });
}

document.addEventListener("DOMContentLoaded", () => {
    updateStudentName();

    setUpWelcomeForm();
    setUpOrderForm();
    setUpStatusForm();
    setUpProfile();
    setUpDeleteButton();
    setUpNotifications();
    setUpBackButton();
    setUpLogout();

    if ($("recentOrders")) {
        loadOrders();
    }
});
