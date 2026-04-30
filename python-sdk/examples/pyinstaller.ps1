python .\make_build_info.py --app-id my_tool --version 1.0.0 --batch-id friend-group-a --endpoint https://replace-with-your-worker.workers.dev
pyinstaller --onefile --name my-tool .\cli_app.py --add-data "build_info.py;."
