import {
    ICredentialType,
    INodeProperties,
    ICredentialTestRequest,
} from 'n8n-workflow';

export class MpesaApi implements ICredentialType {
    name = 'mpesaApi';
    displayName = 'M-Pesa API';
    documentationUrl = 'https://developer.safaricom.co.ke/Documentation';
    properties: INodeProperties[] = [
        {
            displayName: 'Environment',
            name: 'environment',
            type: 'options',
            options: [
                {
                    name: 'Sandbox',
                    value: 'sandbox',
                },
                {
                    name: 'Production',
                    value: 'production',
                },
            ],
            default: 'sandbox',
            description: 'Select the M-Pesa environment to use',
        },
        {
            displayName: 'Consumer Key',
            name: 'consumerKey',
            type: 'string',
            typeOptions: {
                password: true,
            },
            default: '',
            required: true,
            description: 'The Consumer Key from your Safaricom Developer Portal app',
        },
        {
            displayName: 'Consumer Secret',
            name: 'consumerSecret',
            type: 'string',
            typeOptions: {
                password: true,
            },
            default: '',
            required: true,
            description: 'The Consumer Secret from your Safaricom Developer Portal app',
        },
    ];

    test: ICredentialTestRequest = {
        request: {
            baseURL: '={{$credentials.environment === "sandbox" ? "https://sandbox.safaricom.co.ke" : "https://api.safaricom.co.ke"}}',
            url: '/oauth/v1/generate',
            method: 'GET',
            qs: {
                grant_type: 'client_credentials',
            },
            auth: {
                username: '={{$credentials.consumerKey}}',
                password: '={{$credentials.consumerSecret}}',
            },
        },
    };
}
