import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("verify_hub_public", Path(__file__).with_name("verify-hub-public.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def correct_response(url):
    if url.startswith("https://nexohub."):
        path = url.split(".ia.br", 1)[1]
        target = path if path.startswith("/hub/") else "/hub" + path
        return 301, {"Location": "https://nexojuris.ia.br" + target}, b""
    if url.endswith("/health"):
        return 200, {}, b'{"status":"healthy"}'
    return 200, {}, b"<title>NexoHub</title>"


class PublicContractTest(unittest.TestCase):
    def test_accepts_public_contract(self):
        self.assertEqual(module.verify(correct_response), [])

    def test_rejects_double_slash_observed_in_old_configuration(self):
        def fetch(url):
            code, headers, body = correct_response(url)
            if "Location" in headers:
                headers["Location"] = headers["Location"].replace("/hub/", "/hub//")
            return code, headers, body
        self.assertTrue(any("Location=" in failure for failure in module.verify(fetch)))

    def test_rejects_wrong_app_even_if_http_200(self):
        def fetch(url):
            if url == "https://nexojuris.ia.br/hub/img":
                return 200, {}, b"<title>ForgeLex</title>"
            return correct_response(url)
        self.assertTrue(any("/hub/img" in failure for failure in module.verify(fetch)))

    def test_rejects_unhealthy_api_and_root_failure(self):
        def fetch(url):
            if url.endswith("/health"):
                return 200, {}, b'{"status":"degraded"}'
            if url == "https://nexojuris.ia.br/":
                return 503, {}, b""
            return correct_response(url)
        self.assertEqual(len(module.verify(fetch)), 2)


if __name__ == "__main__":
    unittest.main()
