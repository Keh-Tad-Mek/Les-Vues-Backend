// utils/headers.js
export function getHeadersFromRequest(req) {
	const headers = new Headers();

	// Copy all headers from Express request
	for (const [key, value] of Object.entries(req.headers)) {
		if (value) {
			headers.set(key, Array.isArray(value) ? value.join(', ') : value);
		}
	}

	return headers;
}
