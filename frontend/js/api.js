// api.js - Centralized API Service for CropAI Application

const API_BASE_URL = 'http://localhost:5000/api';

// Helper to get auth token
const getToken = () => localStorage.getItem('token');
const getAuthHeaders = () => {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Generic API Call wrapper
async function apiCall(endpoint, method = 'GET', body = null, isFormData = false) {
    const headers = getAuthHeaders();
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    const options = {
        method,
        headers,
    };

    if (body) {
        options.body = isFormData ? body : JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const data = await response.json();
        
        // Handle unauthorized (token expired) globally
        if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login.html?expired=true';
            return { success: false, message: 'Session expired' };
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, message: 'Network error. Please check backend server.' };
    }
}

// Auth API
const AuthAPI = {
    login: (email, password) => apiCall('/auth/login', 'POST', { email, password }),
    register: (userData) => apiCall('/auth/register', 'POST', userData),
    adminLogin: (email, password) => apiCall('/auth/admin-login', 'POST', { email, password }),
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    },
    me: () => apiCall('/auth/me', 'GET')
};

// User Profile API
const UserAPI = {
    getProfile: () => apiCall('/users/profile', 'GET'),
    updateProfile: (data) => apiCall('/users/profile', 'PUT', data)
};

// Farm API
const FarmAPI = {
    getAll: () => apiCall('/farms', 'GET'),
    getOne: (id) => apiCall(`/farms/${id}`, 'GET'),
    create: (data) => apiCall('/farms', 'POST', data),
    update: (id, data) => apiCall(`/farms/${id}`, 'PUT', data),
    delete: (id) => apiCall(`/farms/${id}`, 'DELETE')
};

// Soil API
const SoilAPI = {
    saveRecord: (data) => apiCall('/soil', 'POST', data),
    getRecords: (farmId) => apiCall(`/soil/${farmId}`, 'GET'),
    uploadImage: (formData) => apiCall('/soil/images', 'POST', formData, true),
    getBenchmarks: (district) => apiCall(`/soil/benchmarks/${district}`, 'GET')
};

// Recommendation API
const RecAPI = {
    generate: (data) => apiCall('/recommendations/generate', 'POST', data),
    getHistory: () => apiCall('/recommendations', 'GET'),
    getAll: () => apiCall('/recommendations', 'GET'),
    getDetails: (id) => apiCall(`/recommendations/${id}`, 'GET'),
    getMLHealth: () => apiCall('/recommendations/ml/health', 'GET'),
    getModelInfo: () => apiCall('/recommendations/ml/model-info', 'GET')
};
const RecommendationAPI = RecAPI;

// Weather API
const WeatherAPI = {
    getCurrent: (lat, lon, location) => {
        if (location) return apiCall(`/weather/current?location=${encodeURIComponent(location)}`, 'GET');
        return apiCall(`/weather/current?lat=${lat}&lon=${lon}`, 'GET');
    },
    getForecast: (lat, lon, location) => {
        if (location) return apiCall(`/weather/forecast?location=${encodeURIComponent(location)}`, 'GET');
        return apiCall(`/weather/forecast?lat=${lat}&lon=${lon}`, 'GET');
    },
    getMultiMonth: (district, state, months = 4, crop = 'rice', farmId = null) => {
        let q = `?months=${months}`;
        if (district) q += `&district=${encodeURIComponent(district)}`;
        if (state)    q += `&state=${encodeURIComponent(state)}`;
        if (crop)     q += `&crop=${encodeURIComponent(crop)}`;
        if (farmId)   q += `&farm_id=${farmId}`;
        return apiCall(`/weather/multi-month${q}`, 'GET');
    }
};

// Market API
const MarketAPI = {
    getPrices: (state, district, commodity, limit = 50) => {
        let query = `?limit=${limit}`;
        if (state) query += `&state=${encodeURIComponent(state)}`;
        if (district) query += `&district=${encodeURIComponent(district)}`;
        if (commodity) query += `&commodity=${encodeURIComponent(commodity)}`;
        return apiCall(`/market/prices${query}`, 'GET');
    },
    getNearbyPrices: (lat, lon, commodity) => {
        let query = `?lat=${lat}&lon=${lon}`;
        if (commodity) query += `&commodity=${encodeURIComponent(commodity)}`;
        return apiCall(`/market/nearby${query}`, 'GET');
    },
    getCropPrices: (cropName) => apiCall(`/market/crops/${encodeURIComponent(cropName)}`, 'GET'),
    getTrends: (commodity, state) => {
        let query = `?commodity=${encodeURIComponent(commodity)}`;
        if (state) query += `&state=${encodeURIComponent(state)}`;
        return apiCall(`/market/trends${query}`, 'GET');
    },
    getCommodities: () => apiCall('/market/commodities', 'GET'),
    getDistricts: () => apiCall('/market/districts', 'GET')
};

// Crop History API
const CropAPI = {
    getHistory: (farmId) => apiCall(`/crop-history/${farmId}`, 'GET'),
    addHistory: (data) => apiCall('/crop-history', 'POST', data),
    updateHistory: (id, data) => apiCall(`/crop-history/${id}`, 'PUT', data),
    deleteHistory: (id) => apiCall(`/crop-history/${id}`, 'DELETE')
};

// Admin API
const AdminAPI = {
    getDashboardStats: () => apiCall('/admin/dashboard', 'GET'),
    getUsers: () => apiCall('/admin/users', 'GET'),
    getModels: () => apiCall('/admin/model', 'GET')
};
