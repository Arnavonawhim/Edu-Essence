import torch
from django.conf import settings
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

from videos.languages import INDICTRANS2, model_code, translator_for
from videos.pipeline import model_cache
from videos.pipeline.exceptions import PipelineError
from videos.pipeline.indic_processing import postprocess_english, preprocess_indic

TARGET_CODE = 'eng_Latn'
MAX_TOKENS = 256


class Seq2SeqTranslator:
    trust_remote_code = False

    def __init__(self, model_name, device):
        self.name = model_name
        self.device = device

    def translate(self, texts, language):
        tokenizer, model = model_cache.load(('translator', self.name, self.device), self.load)
        prepared, context = self.prepare(tokenizer, texts, model_code(language))
        count = settings.DUBBING_TRANSLATION_CANDIDATES

        inputs = tokenizer(
            prepared,
            truncation=True,
            max_length=MAX_TOKENS,
            padding='longest',
            return_tensors='pt',
            return_attention_mask=True,
        ).to(self.device)

        with torch.inference_mode():
            output = model.generate(
                **inputs,
                **self.generation_options(tokenizer),
                num_beams=max(settings.DUBBING_TRANSLATION_BEAMS, count),
                num_return_sequences=count,
                max_length=MAX_TOKENS,
                use_cache=True,
                output_scores=True,
                return_dict_in_generate=True,
            )

        decoded = tokenizer.batch_decode(
            output.sequences,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=True,
        )
        decoded = self.finish(decoded, context, count)
        scores = output.sequences_scores.tolist()

        return [
            list(zip(decoded[position * count:(position + 1) * count], scores[position * count:(position + 1) * count]))
            for position in range(len(texts))
        ]

    def load(self):
        dtype = torch.float16 if self.device == 'cuda' else torch.float32
        options = {
            'trust_remote_code': self.trust_remote_code,
            'token': settings.HF_TOKEN or None,
        }

        try:
            tokenizer = AutoTokenizer.from_pretrained(self.name, **options)
            model = AutoModelForSeq2SeqLM.from_pretrained(
                self.name,
                torch_dtype=dtype,
                low_cpu_mem_usage=True,
                **options,
            )
        except OSError as error:
            raise PipelineError(
                f'Could not load {self.name}: {error}. If the model is gated, accept its licence '
                'on huggingface.co and set HF_TOKEN in .env.'
            ) from error

        return tokenizer, model.to(self.device).eval()

    def prepare(self, tokenizer, texts, source_code):
        return texts, None

    def generation_options(self, tokenizer):
        return {}

    def finish(self, decoded, context, count):
        return [text.strip() for text in decoded]


class IndicTrans2Translator(Seq2SeqTranslator):
    trust_remote_code = True

    def prepare(self, tokenizer, texts, source_code):
        prepared = [preprocess_indic(text, source_code, TARGET_CODE) for text in texts]
        return [item.text for item in prepared], [item.placeholders for item in prepared]

    def finish(self, decoded, placeholders, count):
        return [
            postprocess_english(text, placeholders[position // count]).strip()
            for position, text in enumerate(decoded)
        ]


class NllbTranslator(Seq2SeqTranslator):
    def prepare(self, tokenizer, texts, source_code):
        tokenizer.src_lang = source_code
        return texts, None

    def generation_options(self, tokenizer):
        return {'forced_bos_token_id': tokenizer.convert_tokens_to_ids(TARGET_CODE)}


def get_translator(language, device):
    if translator_for(language) == INDICTRANS2:
        return IndicTrans2Translator(settings.DUBBING_INDICTRANS2_MODEL, device)
    return NllbTranslator(settings.DUBBING_NLLB_MODEL, device)
