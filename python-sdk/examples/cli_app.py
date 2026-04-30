from app_guard import default_cli_prompt, exit_if_disabled, startup_check
from build_info import APP_ID, BATCH_ID, BUILD_ID, CHANNEL, ENDPOINT, VERSION


def main() -> None:
    result = startup_check(
        app_id=APP_ID,
        version=VERSION,
        build_id=BUILD_ID,
        batch_id=BATCH_ID,
        channel=CHANNEL,
        endpoint=ENDPOINT,
        prompt_handler=default_cli_prompt,
    )
    exit_if_disabled(result)
    print("main program starts here")


if __name__ == "__main__":
    main()
