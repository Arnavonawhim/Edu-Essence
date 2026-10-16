class ProviderError(Exception):
    def __init__(self, provider, message):
        self.provider = provider
        self.message = message
        super().__init__(f'{provider}: {message}')


class Provider:
    name = 'provider'

    def is_configured(self):
        raise NotImplementedError
