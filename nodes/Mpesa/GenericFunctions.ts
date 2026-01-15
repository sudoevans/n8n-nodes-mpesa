import {
    IExecuteFunctions,
    IHookFunctions,
    ILoadOptionsFunctions,
    IDataObject,
    JsonObject,
    NodeApiError,
    IHttpRequestOptions,
    IHttpRequestMethods,
} from 'n8n-workflow';

// Token cache to store tokens per environment and consumer key
const tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

export async function getAccessToken(
    this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions,
): Promise<string> {
    const credentials = await this.getCredentials('mpesaApi');
    const environment = credentials.environment as string;
    const consumerKey = (credentials.consumerKey as string).trim();
    const consumerSecret = (credentials.consumerSecret as string).trim();

    const cacheKey = `${environment}-${consumerKey}`;
    const now = Date.now();

    // Check if valid token exists in cache (with 5 minute buffer)
    /* 
    // Temporarily disabled to fix "Invalid Access Token" issues
    if (tokenCache.has(cacheKey)) {
        const cached = tokenCache.get(cacheKey)!;
        if (cached.expiresAt > now + 300000) {
            return cached.token;
        }
    }
    */

    const baseUrl =
        environment === 'sandbox'
            ? 'https://sandbox.safaricom.co.ke'
            : 'https://api.safaricom.co.ke';

    const options: IHttpRequestOptions = {
        method: 'GET',
        url: `${baseUrl}/oauth/v1/generate`,
        qs: {
            grant_type: 'client_credentials',
        },
        auth: {
            username: consumerKey,
            password: consumerSecret,
        },
        returnFullResponse: false,
    };

    try {
        const response = await this.helpers.httpRequest(options);
        const expiresIn = parseInt(response.expires_in, 10) || 3599;

        // Store in cache
        tokenCache.set(cacheKey, {
            token: response.access_token,
            expiresAt: now + (expiresIn * 1000),
        });

        return response.access_token;
    } catch (error) {
        throw new NodeApiError(this.getNode(), error as JsonObject);
    }
}

export async function mpesaApiRequest(
    this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
    method: IHttpRequestMethods,
    endpoint: string,
    body: any = {},
    qs: IDataObject = {},
): Promise<any> {
    const credentials = await this.getCredentials('mpesaApi');
    const environment = credentials.environment as string;
    const consumerKey = (credentials.consumerKey as string).trim();
    const baseUrl =
        environment === 'sandbox'
            ? 'https://sandbox.safaricom.co.ke'
            : 'https://api.safaricom.co.ke';

    let accessToken = await getAccessToken.call(this);

    const makeRequest = async (token: string) => {
        const options: IHttpRequestOptions = {
            method,
            url: `${baseUrl}${endpoint}`,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body,
            qs,
            returnFullResponse: false,
        };
        return await this.helpers.httpRequest(options);
    };

    try {
        return await makeRequest(accessToken);
    } catch (error) {
        const errorData = error as any;
        const errorResponse = errorData.error as any;

        // Check for 401 or 404 with Invalid Access Token message/code
        const isInvalidToken =
            errorData.statusCode === 401 ||
            (errorData.statusCode === 404 && (
                (errorData.message && errorData.message.includes('Invalid Access Token')) ||
                (errorResponse && errorResponse.errorMessage === 'Invalid Access Token') ||
                (errorResponse && errorResponse.errorCode === '404.001.03')
            ));

        if (isInvalidToken) {
            const cacheKey = `${environment}-${consumerKey}`;
            tokenCache.delete(cacheKey);

            // Fetch new token
            accessToken = await getAccessToken.call(this);
            return await makeRequest(accessToken);
        }
        throw new NodeApiError(this.getNode(), error as JsonObject);
    }
}
